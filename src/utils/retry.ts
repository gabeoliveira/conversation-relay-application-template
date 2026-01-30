import logger from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', '429', '500', '502', '503', '504']
};

/**
 * Retries an async operation with exponential backoff
 *
 * @param operation - The async function to retry
 * @param options - Retry configuration options
 * @param context - Context object for logging (e.g., { conversationSid, requestId })
 * @returns The result of the operation
 *
 * @example
 * const result = await withRetry(
 *   () => client.messages.list({ from: phone, limit: 1 }),
 *   { maxRetries: 3 },
 *   { operation: 'fetch messages', phone }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
  context: Record<string, any> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxRetries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry = isRetryableError(error, opts.retryableErrors);

      if (!shouldRetry || attempt > opts.maxRetries) {
        logger.error('Operation failed after retries', {
          ...context,
          attempt,
          maxRetries: opts.maxRetries,
          error: error.message || error
        });
        throw error;
      }

      logger.warn('Operation failed, retrying', {
        ...context,
        attempt,
        maxRetries: opts.maxRetries,
        nextRetryIn: delay,
        error: error.message || error
      });

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff with max delay cap
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Determines if an error should be retried
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  // Check error code
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }

  // Check HTTP status code
  if (error.status && retryableErrors.includes(String(error.status))) {
    return true;
  }

  // Check Twilio error codes
  if (error.code && typeof error.code === 'number') {
    const statusCode = String(error.code);
    if (retryableErrors.includes(statusCode)) {
      return true;
    }
  }

  // Check for network errors in message
  if (error.message) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('socket hang up')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
