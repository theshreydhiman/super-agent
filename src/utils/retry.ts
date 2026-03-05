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
 * Useful for handling GitHub API rate limits and AI provider transient errors.
 *
 * - 429 rate limits: retried with Retry-After header respected if present
 * - 429 quota exhaustion (e.g. "quota exceeded"): fails immediately
 * - 401/403 auth errors: fails immediately
 * - All other errors: retried with exponential backoff
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
            const message = error.message || '';
            const status = error.status || error.statusCode;

            // Auth errors never recover — fail immediately
            const isAuthError = status === 401 || status === 403;
            if (isAuthError) {
                log.error(`${label}: Auth error (${status}), failing immediately`, { error: message });
                throw error;
            }

            // 429: distinguish between transient rate limits (retryable) and hard quota exhaustion (not retryable)
            if (status === 429) {
                const isQuotaExhausted = /quota|exceeded.*limit|billing/i.test(message);
                if (isQuotaExhausted) {
                    log.error(`${label}: Quota exhausted, failing immediately`, { error: message });
                    throw error;
                }

                // Transient rate limit — respect Retry-After header if present
                const retryAfter = error.response?.headers?.['retry-after'];
                if (retryAfter && attempt <= opts.maxRetries) {
                    const waitMs = Math.min(parseInt(retryAfter, 10) * 1000 || opts.baseDelayMs, opts.maxDelayMs);
                    log.warn(`${label}: Rate limited (429), waiting ${Math.round(waitMs)}ms (Retry-After)`, { error: message });
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                    continue;
                }
            }

            // Last attempt — throw
            if (attempt > opts.maxRetries) {
                log.error(`${label}: All ${opts.maxRetries} retries exhausted`, { error: message });
                throw error;
            }

            const delay = Math.min(
                opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
                opts.maxDelayMs
            );

            log.warn(`${label}: Attempt ${attempt}/${opts.maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`, {
                error: message,
            });

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // Should never reach here
    throw new Error(`${label}: Unexpected retry exit`);
}
