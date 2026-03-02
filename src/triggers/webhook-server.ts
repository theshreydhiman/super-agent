import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SuperAgent } from '../agents/super-agent';
import { createLogger } from '../utils/logger';

const log = createLogger('WebhookServer');

export class WebhookServer {
    private app: express.Application;
    private superAgent: SuperAgent;

    constructor(app: express.Application, superAgent: SuperAgent) {
        this.app = app;
        this.superAgent = superAgent;
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Webhook needs raw body for signature verification
        const webhookJsonParser = express.json({
            verify: (req: any, _res, buf) => {
                req.rawBody = buf;
            },
        });

        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                service: 'Super Agent',
                timestamp: new Date().toISOString(),
            });
        });

        // GitHub webhook endpoint
        this.app.post('/webhook', webhookJsonParser, async (req, res) => {
            try {
                // Verify webhook signature
                if (config.github.webhookSecret) {
                    const signature = req.headers['x-hub-signature-256'] as string;
                    if (!this.verifySignature((req as any).rawBody, signature)) {
                        log.warn('Invalid webhook signature');
                        res.status(401).json({ error: 'Invalid signature' });
                        return;
                    }
                }

                const event = req.headers['x-github-event'] as string;
                const payload = req.body;

                log.info(`Received webhook event: ${event}`, {
                    action: payload.action,
                });

                // Handle issue events
                if (event === 'issues') {
                    await this.handleIssueEvent(payload);
                }

                res.status(200).json({ received: true });
            } catch (error: any) {
                log.error('Webhook handler error', { error: error.message });
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }

    private async handleIssueEvent(payload: any): Promise<void> {
        const action = payload.action;
        const issue = payload.issue;
        const labels = (issue.labels || []).map((l: any) => l.name);

        log.info(`Issue event: ${action} for #${issue.number}`, {
            title: issue.title,
            labels,
        });

        const hasTargetLabel = labels.includes(config.github.issueLabel);
        const isNew = action === 'opened';
        const isLabeled = action === 'labeled' &&
            payload.label?.name === config.github.issueLabel;

        if (hasTargetLabel && (isNew || isLabeled)) {
            const repoName = payload.repository?.name;
            log.info(`Triggering Super Agent for issue #${issue.number} in ${repoName || 'configured repo'}`);

            setImmediate(() => {
                if (repoName && !config.github.repo) {
                    this.superAgent.processRepo(repoName).catch((err) => {
                        log.error('Super Agent run failed', { error: err.message });
                    });
                } else {
                    this.superAgent.run().catch((err) => {
                        log.error('Super Agent run failed', { error: err.message });
                    });
                }
            });
        }
    }

    private verifySignature(payload: Buffer, signature: string): boolean {
        if (!signature) return false;

        const expected = `sha256=${crypto
            .createHmac('sha256', config.github.webhookSecret)
            .update(payload)
            .digest('hex')}`;

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expected)
        );
    }
}
