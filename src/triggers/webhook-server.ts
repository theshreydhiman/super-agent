import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SuperAgent } from '../agents/super-agent';
import { createLogger } from '../utils/logger';

const log = createLogger('WebhookServer');

export class WebhookServer {
    private app: express.Application;
    private superAgent: SuperAgent;

    constructor(superAgent: SuperAgent) {
        this.app = express();
        this.superAgent = superAgent;
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // Parse raw body for signature verification, then JSON
        this.app.use(
            express.json({
                verify: (req: any, _res, buf) => {
                    req.rawBody = buf;
                },
            })
        );
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (_req, res) => {
            res.json({
                status: 'ok',
                service: 'Super Agent Webhook Server',
                timestamp: new Date().toISOString(),
            });
        });

        // GitHub webhook endpoint
        this.app.post('/webhook', async (req, res) => {
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

    /**
     * Handles GitHub issue webhook events.
     * Triggers Super Agent when:
     * - A new issue is opened with the configured label
     * - The configured label is added to an existing issue
     */
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
            log.info(`🎯 Triggering Super Agent for issue #${issue.number}`);

            // Run asynchronously so we don't block the webhook response
            setImmediate(() => {
                this.superAgent.run().catch((err) => {
                    log.error('Super Agent run failed', { error: err.message });
                });
            });
        }
    }

    /**
     * Verifies the GitHub webhook signature.
     */
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

    /**
     * Starts the webhook server.
     */
    start(): void {
        const port = config.triggers.webhookPort;
        this.app.listen(port, () => {
            log.info(`🌐 Webhook server listening on port ${port}`);
            log.info(`   Health: http://localhost:${port}/health`);
            log.info(`   Webhook: http://localhost:${port}/webhook`);
        });
    }
}
