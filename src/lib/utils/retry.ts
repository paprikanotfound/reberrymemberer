
/**
 * @param fn The function to call for each attempt. Receives the attempt number.
 * @param isRetryable The function to call to determine if the error is retryable. Receives the error and the next attempt number.
 * @param options The options for the retry strategy.
 * @param options.baseDelayMs Number of milliseconds to use as multiplier for the exponential backoff.
 * @param options.maxDelayMs Maximum number of milliseconds to wait.
 * @param options.verbose If true, logs the error and attempt number to the console.
 * @returns The result of the `fn` function or propagates the last error thrown once `isRetryable` returns false or all retries failed.
 */
export async function tryWhile<T>(
  fn: (attempt: number) => Promise<T>,
  isRetryable: (err: unknown, nextAttempt: number) => boolean,
  options?: {
    baseDelayMs?: number;
    maxDelayMs?: number;

    verbose?: boolean;
  }
): Promise<T> {
  const baseDelayMs = Math.floor(options?.baseDelayMs ?? 100);
  const maxDelayMs = Math.floor(options?.maxDelayMs ?? 3000);
  if (baseDelayMs <= 0 || maxDelayMs <= 0) {
    throw new Error("baseDelayMs and maxDelayMs must be greater than 0");
  }
  if (baseDelayMs >= maxDelayMs) {
    throw new Error("baseDelayMs must be less than maxDelayMs");
  }
  let attempt = 1;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (options?.verbose) {
        console.info({
          message: "tryWhile",
          attempt,
          error: String(err),
          errorProps: err,
        });
      }
      attempt += 1;
      if (!isRetryable(err, attempt)) {
        throw err;
      }
      const delay = jitterBackoff(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export type TryNOptions = {
  /**
   * @param err Error thrown by the function.
   * @param nextAttempt Number of next attempt to make.
   * @returns Returns true if the error and nextAttempt number is retryable.
   */
  isRetryable?: (err: unknown, nextAttempt: number) => boolean;

  /**
   * Number of milliseconds to use as multiplier for the exponential backoff.
   */
  baseDelayMs?: number;
  /**
   * Maximum number of milliseconds to wait.
   */
  maxDelayMs?: number;

  /**
   * If true, logs the error and attempt number to the console.
   */
  verbose?: boolean;
};

/**
 * @param n Number of total attempts to make.
 * @param fn The function to call for each attempt. Receives the attempt number.
 * @param options The options for the retry strategy.
 * @param options.isRetryable The function to call to determine if the error is retryable. Receives the error and the next attempt number.
 * @param options.baseDelayMs Number of milliseconds to use as multiplier for the exponential backoff.
 * @param options.maxDelayMs Maximum number of milliseconds to wait.
 * @param options.verbose If true, logs the error and attempt number to the console.
 * @returns The result of the `fn` function or propagates the last error thrown once `isRetryable` returns false or all retries failed.
 */
export async function tryN<T>(
  fn: (attempt: number) => Promise<T>,
  n: number = 3,
  options?: TryNOptions
): Promise<T> {
  if (n <= 0) {
    throw new Error("n must be greater than 0");
  }
  n = Math.floor(n);

  return await tryWhile(
    fn,
    (err: unknown, nextAttempt: number) => {
      return (
        nextAttempt <= n && (options?.isRetryable?.(err, nextAttempt) ?? true)
      );
    },
    options
  );
}

/**
 * Returns the number of milliseconds to wait before retrying a request.
 * See the "Full Jitter" approach in https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/.
 * @param attempt The number of attempts so far.
 * @param baseDelayMs Number of milliseconds to use as multiplier for the exponential backoff.
 * @param maxDelayMs Maximum number of milliseconds to wait.
 * @returns Milliseconds to wait before retrying.
 */
export function jitterBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const attemptUpperBoundMs = Math.min(2 ** attempt * baseDelayMs, maxDelayMs);
  return Math.floor(Math.random() * attemptUpperBoundMs);
}

/**
 * Returns true if the given error is retryable according to the Durable Object error handling.
 * See https://developers.cloudflare.com/durable-objects/best-practices/error-handling/.
 * @param err
 */
export function isErrorRetryableDO(err: unknown): boolean {
  const msg = String(err);
  return (
    Boolean((err as any)?.retryable) &&
    !Boolean((err as any)?.overloaded) &&
    !msg.includes("Durable Object is overloaded")
  );
}

/**
 * Returns true if the given error is retryable according to the D1 error handling.
 * See https://developers.cloudflare.com/d1/best-practices/retry-queries/
 * @param err
 */
export function isErrorRetryableD1(err: unknown, nextAttempt: number) {
  const errMsg = String(err);
  const isRetryableError =
    errMsg.includes("Network connection lost") ||
    errMsg.includes("storage caused object to be reset") ||
    errMsg.includes("reset because its code was updated");
  if (nextAttempt <= 5 && isRetryableError) {
    return true;
  }
  return false;
}

/**
 * Returns true if the given error is retryable according to R2 error handling.
 * See https://developers.cloudflare.com/r2/api/error-codes/
 * See https://developers.cloudflare.com/r2/platform/troubleshooting/
 * @param err The error thrown by the R2 API call
 * @param nextAttempt The next attempt number (1-based)
 */
export function isErrorRetryableR2(err: unknown, nextAttempt: number): boolean {
  const MAX_RETRIES = 5;
  if (nextAttempt > MAX_RETRIES) return false;

  if (!err || typeof err !== "object") return false;

  const status = (err as any).status || (err as any).statusCode;
  const code = (err as any).code;
  const message = (err as any).message || String(err);

  // Retry on 5XX server errors
  if (status && status >= 500 && status < 600) return true;

  // Retry on specific R2 error codes
  // 10001 - InternalError (500)
  // 10043 - ServiceUnavailable (503)
  // 10058 - TooManyRequests (429)
  const retryableR2Codes = [10001, 10043, 10058];
  if (code && retryableR2Codes.includes(Number(code))) return true;

  // Retry on rate limiting (429)
  if (status === 429) return true;

  // Retry on transient network errors
  // 10013 - IncompleteBody (400)
  // 10054 - ClientDisconnect (400)
  const transientErrorMessages = [
    "InternalError",
    "ServiceUnavailable",
    "TooManyRequests",
    "IncompleteBody",
    "ClientDisconnect",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "timeout",
    "temporarily unavailable",
  ];

  if (
    transientErrorMessages.some((errMsg) =>
      message.toLowerCase().includes(errMsg.toLowerCase())
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether a failed OpenAI Responses API call should be retried.
 * @param err The error thrown by the API call
 * @param attempt The current attempt number (1-based)
 */
export function isOpenAIRetryable(err: unknown, attempt: number): boolean {
  // Limit max retries (optional)
  const MAX_RETRIES = 5;
  if (attempt > MAX_RETRIES) return false;

  if (!err || typeof err !== "object") return false;

  // If using the official OpenAI client, errors may have 'status' and 'code'
  const status = (err as any).status;
  const code = (err as any).code;
  const message = (err as any).message || "";

  // Retry on rate limits
  if (status === 429 || code === "rate_limit_error") return true;

  // Retry on server errors (5xx)
  if (status && status >= 500 && status < 600) return true;

  // Retry on specific transient network errors
  if (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }

  // Optional: retry on certain message patterns
  if (message.includes("timeout") || message.includes("temporary")) {
    return true;
  }

  return false; // otherwise, do not retry
}

/**
 * Determines whether a failed Resend API call should be retried.
 * See https://resend.com/docs/api-reference/errors
 * @param err The error thrown by the Resend API call
 * @param nextAttempt The next attempt number (1-based)
 * @returns True if the error is retryable, false otherwise
 */
export function isErrorRetryableResend(err: unknown, nextAttempt: number): boolean {
  const MAX_RETRIES = 5;
  if (nextAttempt > MAX_RETRIES) return false;

  if (!err || typeof err !== "object") return false;

  const status = (err as any).statusCode || (err as any).status;
  const errorName = (err as any).name;
  const message = (err as any).message || String(err);

  // Retry on server errors (500)
  // application_error, internal_server_error
  if (status && status >= 500 && status < 600) return true;

  // Retry on rate limiting (429) with exponential backoff
  // rate_limit_exceeded, daily_quota_exceeded, monthly_quota_exceeded
  if (status === 429) return true;

  // Retry on concurrent idempotent requests (409)
  // concurrent_idempotent_requests: "Try the request again later"
  if (status === 409 && message.includes("concurrent")) return true;

  // Retry on transient network errors
  const transientNetworkErrors = [
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ENETUNREACH",
    "ECONNREFUSED",
  ];
  if (
    errorName &&
    transientNetworkErrors.some((errName) =>
      errorName.toUpperCase().includes(errName)
    )
  ) {
    return true;
  }

  if (
    transientNetworkErrors.some((errMsg) =>
      message.toUpperCase().includes(errMsg)
    )
  ) {
    return true;
  }

  // Retry on timeout messages
  if (message.toLowerCase().includes("timeout")) return true;

  // Non-retryable errors:
  // 400: validation_error, invalid_idempotency_key
  // 401: missing_api_key, restricted_api_key
  // 403: invalid_api_key, validation_error (domain issues)
  // 404: not_found
  // 405: method_not_allowed
  // 422: invalid_attachment, invalid_from_address, invalid_access, etc.
  // 451: security_error

  return false;
}

