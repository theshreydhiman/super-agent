import http from 'http';
import { config } from './config';
import { WebhookServer } from './triggers/webhook-server';
import { createApp } from './server';
import { runMigrations } from './db/migrate';
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
    if (config.sessionSecret === 'super-agent-secret-change-me') {
        log.warn('SESSION_SECRET is using the default value — sessions can be forged. Set SESSION_SECRET in .env');
    }

    if (!config.github.clientId || !config.github.clientSecret) {
        log.warn('GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set — OAuth login will not work');
    }

    // Initialize database
    try {
        await runMigrations();
        log.info('Database initialized');
    } catch (error: any) {
        log.warn('Database initialization failed (dashboard will be unavailable):', { error: error.message });
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

    // Track active schedulers for cleanup on shutdown
    const activeSchedulers: SchedulerInstance[] = [];

    // TODO: Configure your API endpoint below
    // Example: startApiPoller('http://localhost:3000/api/your-endpoint', 14)
    const apiScheduler = startApiPoller('http://localhost:3001/health', 14);
    activeSchedulers.push(apiScheduler);

    // Graceful shutdown
    const shutdown = (signal: string) => {
        log.info(`${signal} received. Shutting down gracefully...`);

        // Stop all active schedulers
        activeSchedulers.forEach((scheduler) => scheduler.stop());

        server.close(() => {
            log.info('HTTP server closed');
            process.exit(0);
        });
        // Force exit after 10s if connections don't close
        setTimeout(() => {
            log.warn('Forcing shutdown after timeout');
            process.exit(1);
        }, 10000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Catch unhandled rejections so background agent runs don't crash the process
    process.on('unhandledRejection', (reason: any) => {
        log.error('Unhandled promise rejection', { error: reason?.message || reason });
    });

    log.info('Super Agent is running. Press Ctrl+C to stop.');
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
