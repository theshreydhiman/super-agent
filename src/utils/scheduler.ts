import { createLogger } from './logger';

const log = createLogger('Scheduler');

export interface SchedulerOptions {
    intervalMs: number;
    immediate?: boolean;
}

export interface SchedulerInstance {
    stop: () => void;
}

/**
 * Starts a recurring task that executes every specified interval
 * @param taskName - Name of the task for logging
 * @param task - Async function to execute
 * @param options - Scheduler options (intervalMs, immediate)
 * @returns Scheduler instance with stop method
 */
export function startScheduler(
    taskName: string,
    task: () => Promise<void>,
    options: SchedulerOptions
): SchedulerInstance {
    let intervalId: NodeJS.Timeout | null = null;
    let isRunning = true;

    const execute = async () => {
        if (!isRunning) return;

        try {
            log.debug(`Executing scheduled task: ${taskName}`);
            await task();
            log.debug(`Completed scheduled task: ${taskName}`);
        } catch (error: any) {
            log.error(`Error executing scheduled task ${taskName}:`, {
                error: error?.message || error,
            });
        }
    };

    // Execute immediately if requested
    if (options.immediate) {
        execute();
    }

    // Schedule recurring execution
    intervalId = setInterval(execute, options.intervalMs);

    log.info(
        `Scheduled task "${taskName}" started (interval: ${options.intervalMs}ms / ${(options.intervalMs / 1000 / 60).toFixed(1)} minutes)`
    );

    return {
        stop: () => {
            isRunning = false;
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
                log.info(`Scheduled task "${taskName}" stopped`);
            }
        },
    };
}

/**
 * Creates a scheduler for calling an API endpoint every 14 minutes
 * @param apiUrl - The API endpoint URL to call
 * @param intervalMinutes - Interval in minutes (default: 14)
 * @returns Scheduler instance
 */
export function startApiPoller(
    apiUrl: string,
    intervalMinutes: number = 14
): SchedulerInstance {
    const intervalMs = intervalMinutes * 60 * 1000;

    return startScheduler(
        `API Poller: ${apiUrl}`,
        async (): Promise<void> => {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`API returned status ${response.status}`);
            }

            await response.json();
        },
        { intervalMs, immediate: false }
    );
}
