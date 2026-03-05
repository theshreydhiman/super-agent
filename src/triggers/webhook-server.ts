import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SuperAgent } from '../agents/super-agent';
import { getPool } from '../db/connection';
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

        // Health check — verify DB connectivity
        this.app.get('/health', async (_req, res) => {
            const health: { status: string; service: string; timestamp: string; database?: string } = {
                status: 'ok',
                service: 'Super Agent',
                timestamp: new Date().toISOString(),
            };

            try {
                const pool = getPool();
                await pool.execute('SELECT 1');
                health.database = 'connected';
            } catch {
                health.status = 'degraded';
                health.database = 'disconnected';
            }

            const statusCode = health.status === 'ok' ? 200 : 503;
            res.status(statusCode).json(health);
        });

        // GitHub webhook endpoint
        this.app.post('/webhook', webhookJsonParser, async (req, res) => {
            try {
                // Verify webhook signature
                if (config.github.webhookSecret) {
                    const signature = req.headers['x-hub-signature-256'] as string;
                    if (!signature || !this.verifySignature((req as any).rawBody, signature)) {
                        log.warn('Invalid webhook signature');
                        res.status(401).json({ error: 'Invalid signature' });
                        return;
                    }
                } else {
                    log.warn('Webhook secret not configured — signature verification skipped');
                }

                const event = req.headers['x-github-event'] as string;
                const payload = req.body;

                if (!event) {
                    res.status(400).json({ error: 'Missing X-GitHub-Event header' });
                    return;
                }

                log.info(`Received webhook event: ${event}`, {
                    action: payload.action,
                    repo: payload.repository?.full_name,
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

        if (!issue) {
            log.warn('Webhook payload missing issue object');
            return;
        }

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
            if (!repoName) {
                log.warn('Webhook payload missing repository name');
                return;
            }

            log.info(`Triggering Super Agent for issue #${issue.number} in ${repoName}`);

            setImmediate(() => {
                if (repoName && !config.github.repo) {
                    this.superAgent.processRepo(repoName).catch((err) => {
                        log.error(`Super Agent run failed for ${repoName}`, { error: err.message });
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
        if (!signature || !payload) return false;

        const expected = `sha256=${crypto
            .createHmac('sha256', config.github.webhookSecret)
            .update(payload)
            .digest('hex')}`;

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);

        if (sigBuf.length !== expBuf.length) return false;

        return crypto.timingSafeEqual(sigBuf, expBuf);
    }
}
