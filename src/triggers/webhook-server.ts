import express from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { SuperAgent } from '../agents/super-agent';
import { getPool } from '../db/connection';

import { createLogger } from '../utils/logger';
import { UserRepository } from '../repositories/user-repository';
import { getUserRuntimeConfig } from '../services/user-config';
import { IssueTracker } from '../services/run-tracker';

const log = createLogger('WebhookServer');
const userRepo = new UserRepository();

interface WebhookIssuePayload {
    action: string;
    issue?: {
        number: number;
        title: string;
        labels?: Array<{ name: string }>;
    };
    repository?: {
        name: string;
        full_name: string;
        owner?: { login: string };
    };
    sender?: { id: number };
}

export class WebhookServer {
    private app: express.Application;

    constructor(app: express.Application) {
        this.app = app;
        this.setupRoutes();
    }

    private setupRoutes(): void {
        const rawBodyParser = express.raw({ type: 'application/json' });

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
        this.app.post('/webhook', rawBodyParser, async (req, res) => {
            try {
                const rawBody = req.body as Buffer;
                if (!rawBody || rawBody.length === 0) {
                    res.status(400).json({ error: 'Empty request body' });
                    return;
                }

                // Verify signature BEFORE parsing the payload — use global webhook secret
                const webhookSecret = config.github.webhookSecret;
                if (webhookSecret) {
                    const signature = req.headers['x-hub-signature-256'] as string;

                    if (!signature) {
                        log.warn('Missing x-hub-signature-256 header');
                        res.status(401).json({ error: 'Missing signature header' });
                        return;
                    }

                    if (!this.verifySignature(rawBody, signature, webhookSecret)) {
                        log.warn('Webhook signature mismatch');
                        res.status(401).json({ error: 'Invalid signature' });
                        return;
                    }

                    log.info('Webhook signature verified successfully');
                } else {
                    log.warn('Webhook secret not configured — signature verification skipped');
                }

                let payload: WebhookIssuePayload;
                try {
                    payload = JSON.parse(rawBody.toString('utf8'));
                } catch {
                    log.error('Webhook body is not valid JSON');
                    res.status(400).json({ error: 'Invalid JSON body' });
                    return;
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

                if (event === 'issues') {
                    await this.handleIssueEvent(payload);
                }

                res.status(200).json({ received: true });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                log.error('Webhook handler error', { error: message });
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }

    private async handleIssueEvent(payload: WebhookIssuePayload): Promise<void> {
        const action = payload.action;
        const issue = payload.issue;

        if (!issue) {
            log.warn('Webhook payload missing issue object');
            return;
        }

        const labels = (issue.labels || []).map((l) => l.name);

        log.info(`Issue event: ${action} for #${issue.number}`, {
            title: issue.title,
            labels,
        });

        const hasTargetLabel = labels.includes(config.github.issueLabel);
        const isNew = action === 'opened';
        const isLabeled = action === 'labeled' && hasTargetLabel;

        if (hasTargetLabel && (isNew || isLabeled)) {
            const repoName = payload.repository?.name;
            const repoOwner = payload.repository?.owner?.login;
            if (!repoName || !repoOwner) {
                log.warn('Webhook payload missing repository info');
                return;
            }

            const senderGithubId = payload.sender?.id;
            const user = senderGithubId ? await userRepo.findByGithubId(senderGithubId) : null;

            if (!user) {
                log.warn('Webhook sender not registered', { githubId: senderGithubId });
                return;
            }

            if (!user.github_access_token) {
                log.warn('Webhook sender has no GitHub token — please re-login via dashboard', { user: user.github_login });
                return;
            }

            const userConfig = await getUserRuntimeConfig(user.id, user.github_access_token, user.github_login);
            const tracker = new IssueTracker(user.id);
            const agent = new SuperAgent(tracker.createCallbacks(), userConfig, user.email);

            log.info(`Triggering Super Agent for issue #${issue.number} in ${repoName} (user: ${user.github_login})`);

            setTimeout(() => {
                agent.processRepo(repoName, { owner: repoOwner }).catch((err: Error) => {
                    log.error(`Super Agent run failed for ${repoName}`, { error: err.message });
                });
            }, 1000);
        } else {
            log.info(`Issue #${issue.number} does not meet trigger conditions`, {
                hasTargetLabel,
                isNew,
                isLabeled,
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
