import { config, validateConfig } from './config';
import { SuperAgent } from './agents/super-agent';
import { WebhookServer } from './triggers/webhook-server';
import { CronPoller } from './triggers/cron-poller';
import { createLogger } from './utils/logger';

const log = createLogger('Main');

async function main(): Promise<void> {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🤖  SUPER AGENT                                ║
║   AI-Powered GitHub Issue Automation             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);

    // Validate configuration
    try {
        validateConfig();
        log.info('Configuration validated ✅');
    } catch (error: any) {
        log.error(error.message);
        process.exit(1);
    }

    log.info('Configuration:', {
        owner: config.github.owner,
        repo: config.github.repo || '(all repos — multi-repo mode)',
        devBranch: config.github.devBranch,
        issueLabel: config.github.issueLabel,
        aiProvider: config.aiProvider,
        webhookMode: config.triggers.webhookMode,
        cronMode: config.triggers.cronMode,
        pollInterval: `${config.triggers.pollIntervalMinutes} min`,
        maxConcurrent: config.agent.maxConcurrentAgents,
    });

    const superAgent = new SuperAgent();
    let cronPoller: CronPoller | null = null;

    // Start webhook server if enabled
    if (config.triggers.webhookMode) {
        const webhookServer = new WebhookServer(superAgent);
        webhookServer.start();
    }

    // Start cron poller if enabled
    if (config.triggers.cronMode) {
        cronPoller = new CronPoller(superAgent);
        cronPoller.start();
    }

    // If neither mode is enabled, just run once
    if (!config.triggers.webhookMode && !config.triggers.cronMode) {
        log.info('No trigger mode enabled — running once...');
        await superAgent.run();
        log.info('Single run complete. Exiting.');
        return;
    }

    // Graceful shutdown
    const shutdown = (signal: string) => {
        log.info(`\n${signal} received. Shutting down gracefully...`);
        if (cronPoller) {
            cronPoller.stop();
        }
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    log.info('🟢 Super Agent is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
