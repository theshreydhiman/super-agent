import { config, validateConfig } from './config';
import { SuperAgent } from './agents/super-agent';
import { WebhookServer } from './triggers/webhook-server';
import { createApp } from './server';
import { runMigrations } from './db/migrate';
import { setRunRoutesSuperAgent } from './routes/run-routes';
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
        log.info('Configuration validated');
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
        maxConcurrent: config.agent.maxConcurrentAgents,
    });

    // Initialize database
    try {
        await runMigrations();
        log.info('Database initialized');
    } catch (error: any) {
        log.warn('Database initialization failed (dashboard will be unavailable):', { error: error.message });
    }

    // Create shared Express app
    const app = createApp();

    const superAgent = new SuperAgent();

    // Wire SuperAgent into run routes for manual triggers
    setRunRoutesSuperAgent(superAgent);

    // Setup webhook routes on the shared app
    new WebhookServer(app, superAgent);

    // Start the unified server
    const port = config.triggers.webhookPort;
    app.listen(port, () => {
        log.info(`Server listening on port ${port}`);
        log.info(`   Dashboard: http://localhost:${port}`);
        log.info(`   Health:    http://localhost:${port}/health`);
        log.info(`   Webhook:   http://localhost:${port}/webhook`);
        log.info(`   API:       http://localhost:${port}/api`);
    });

    // Graceful shutdown
    const shutdown = (signal: string) => {
        log.info(`\n${signal} received. Shutting down gracefully...`);
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    log.info('Super Agent is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
