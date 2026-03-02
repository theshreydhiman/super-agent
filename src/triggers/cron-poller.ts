import cron from 'node-cron';
import { SuperAgent } from '../agents/super-agent';
import { config } from '../config';
import { createLogger } from '../utils/logger';

const log = createLogger('CronPoller');

export class CronPoller {
    private superAgent: SuperAgent;
    private task: cron.ScheduledTask | null = null;

    constructor(superAgent: SuperAgent) {
        this.superAgent = superAgent;
    }

    /**
     * Starts the cron-based polling.
     * Runs the Super Agent at the configured interval.
     */
    start(): void {
        const intervalMinutes = config.triggers.pollIntervalMinutes;

        // Build cron expression: "*/N * * * *" for every N minutes
        const cronExpression = `*/${intervalMinutes} * * * *`;

        log.info(`⏰ Starting cron poller: every ${intervalMinutes} minute(s)`);
        log.info(`   Cron expression: ${cronExpression}`);

        this.task = cron.schedule(cronExpression, async () => {
            log.info('⏰ Cron trigger fired — running Super Agent...');
            try {
                await this.superAgent.run();
            } catch (error: any) {
                log.error('Cron-triggered Super Agent run failed', {
                    error: error.message,
                });
            }
        });

        // Also run immediately on startup
        log.info('Running initial check on startup...');
        setImmediate(() => {
            this.superAgent.run().catch((err) => {
                log.error('Initial Super Agent run failed', { error: err.message });
            });
        });
    }

    /**
     * Stops the cron poller.
     */
    stop(): void {
        if (this.task) {
            this.task.stop();
            log.info('Cron poller stopped');
        }
    }
}
