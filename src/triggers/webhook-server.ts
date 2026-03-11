import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SuperAgent } from '../agents/super-agent';
import { getPool } from '../db/connection';
import { createLogger } from '../utils/logger';
import { UserRepository } from '../repositories/user-repository';
import { ConfigRepository } from '../repositories/config-repository';

const log = createLogger('WebhookServer');
const userRepo = new UserRepository();
const configRepo = new ConfigRepository();

export class WebhookServer {
    private app: express.Application;
    private superAgent: SuperAgent;

    constructor(app: express.Application, superAgent: SuperAgent) {
        this.app = app;
        this.superAgent = superAgent;
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Use express.raw() to capture the body as a Buffer — this is immune to
        // other middleware consuming the body stream before we can read it.
        const rawBodyParser = express.raw({ type: 'application/json' });

        // Health check — verify DB connectivity
        this.app.get('/health', async (_req, res) => {
            console.log("Health checked");
            
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

        // GitHub webhook endpoint — body arrives as a raw Buffer via express.raw()
        this.app.post('/webhook', rawBodyParser, async (req, res) => {
            try {
                const rawBody = req.body as Buffer;
                let payload: any;

                try {
                    payload = JSON.parse(rawBody.toString('utf8'));
                } catch {
                    log.error('Webhook body is not valid JSON', { bodyLength: rawBody?.length ?? 0 });
                    res.status(400).json({ error: 'Invalid JSON body' });
                    return;
                }

                // Fetch webhook secret from database
                let webhookSecret = config.github.webhookSecret;
                try {
                    const userId = await userRepo.findByGithubId(payload.sender?.id)?.then(u => u?.id);
                    if (userId) {
                        const dbSecret = await configRepo.get(userId, 'webhook_secret');
                        if (dbSecret) {
                            webhookSecret = dbSecret;
                        }
                    } else {
                        log.warn('Webhook sender not found in database', { githubId: payload.sender?.id });
                    }
                } catch (err) {
                    log.warn('Failed to fetch webhook secret from database', { error: (err as any).message });
                }

                // Verify webhook signature
                if (webhookSecret) {
                    const signature = req.headers['x-hub-signature-256'] as string;

                    log.info('Webhook signature verification', {
                        hasSignatureHeader: !!signature,
                        signaturePrefix: signature ? signature.substring(0, 20) + '...' : 'none',
                        rawBodyLength: rawBody.length,
                        configuredSecretLength: webhookSecret.length,
                    });

                    if (!signature) {
                        log.warn('Missing x-hub-signature-256 header');
                        res.status(401).json({ error: 'Missing signature header' });
                        return;
                    }

                    if (!this.verifySignature(rawBody, signature, webhookSecret)) {
                        const expected = `sha256=${crypto
                            .createHmac('sha256', webhookSecret)
                            .update(rawBody)
                            .digest('hex')}`;
                        log.warn('Webhook signature mismatch', {
                            received: signature.substring(0, 20) + '...',
                            expected: expected.substring(0, 20) + '...',
                        });
                        res.status(401).json({ error: 'Invalid signature' });
                        return;
                    }

                    log.info('Webhook signature verified successfully');
                } else {
                    log.warn('Webhook secret not configured — signature verification skipped');
                }

                const event = req.headers['x-github-event'] as string;

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

    private verifySignature(payload: Buffer, signature: string, webhookSecret: string): boolean {
        if (!signature || !payload) return false;

        const expected = `sha256=${crypto
            .createHmac('sha256', webhookSecret)
            .update(payload)
            .digest('hex')}`;

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);

        if (sigBuf.length !== expBuf.length) return false;

        return crypto.timingSafeEqual(sigBuf, expBuf);
    }
}
