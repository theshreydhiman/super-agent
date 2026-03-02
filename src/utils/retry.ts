import { createLogger } from './logger';

const log = createLogger('Retry');

export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
};

/**
 * Wraps an async function with exponential backoff retry logic.
 * Useful for handling GitHub API rate limits and Gemini transient errors.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            // Don't retry on quota exhaustion or authentication errors — they won't recover
            const message = error.message || '';
            const status = error.status || error.statusCode;
            const isQuotaError = status === 429 && /quota|exceeded.*limit/i.test(message);
            const isAuthError = status === 401 || status === 403;

            if (isQuotaError || isAuthError) {
                log.error(`${label}: Non-retryable error (${isQuotaError ? 'quota exhausted' : 'auth failed'}), failing immediately`, {
                    error: message,
                });
                throw error;
            }

            if (attempt > opts.maxRetries) {
                log.error(`${label}: All ${opts.maxRetries} retries exhausted`, {
                    error: message,
                });
                throw error;
            }

            const delay = Math.min(
                opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
                opts.maxDelayMs
            );

            log.warn(`${label}: Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
                error: message,
            });

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // Should never reach here
    throw new Error(`${label}: Unexpected retry exit`);
}
