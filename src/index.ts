import http from 'http';
import { config } from './config';
import { WebhookServer } from './triggers/webhook-server';
import { createApp } from './server';
import { runMigrations } from './db/migrate';
import { closePool } from './db/connection';
import { createLogger } from './utils/logger';
import { startApiPoller, type SchedulerInstance } from './utils/scheduler';
import { initSocket } from './socket';

const log = createLogger('Main');

async function main(): Promise<void> {
    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   SUPER AGENT                                    ║
║   AI-Powered GitHub Issue Automation             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);

    log.info('Configuration loaded (user settings are fetched from DB at runtime)');

    // Validate critical config
    if (!config.github.clientId || !config.github.clientSecret) {
        log.warn('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set — OAuth login will not work');
    }

    // Initialize database
    try {
        await runMigrations();
        log.info('Database initialized');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log.warn('Database initialization failed (dashboard will be unavailable):', { error: message });
    }

    // Create shared Express app
    const app = createApp();

    // Setup webhook and health routes on the shared app
    new WebhookServer(app);

    // Start the unified server with Socket.IO
    const port = config.triggers.webhookPort;
    const server = http.createServer(app);
    initSocket(server);

    server.listen(port, () => {
        log.info(`Server listening on port ${port}`);
        log.info(`   Dashboard: http://localhost:${port}`);
        log.info(`   Health:    http://localhost:${port}/health`);
        log.info(`   Webhook:   http://localhost:${port}/webhook`);
        log.info(`   API:       http://localhost:${port}/api`);
        log.info(`   Socket.IO: ws://localhost:${port}`);
    });

    // Keep-alive poller (configurable URL for production)
    const activeSchedulers: SchedulerInstance[] = [];
    const healthUrl = process.env.HEALTH_URL || `http://localhost:${port}/health`;
    const apiScheduler = startApiPoller(healthUrl, 14);
    activeSchedulers.push(apiScheduler);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
        log.info(`${signal} received. Shutting down gracefully...`);

        activeSchedulers.forEach((scheduler) => scheduler.stop());

        server.close(async () => {
            try {
                await closePool();
                log.info('Database connections closed');
            } catch {
                // Pool may already be closed
            }
            log.info('HTTP server closed');
            process.exit(0);
        });

        setTimeout(() => {
            log.warn('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', (reason: unknown) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        log.error('Unhandled promise rejection', { error: message });
    });

    log.info('Super Agent is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
