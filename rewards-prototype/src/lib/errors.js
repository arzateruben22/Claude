// One error type for everything the API reports to a client.
// `code` is a stable machine-readable string; `message` is safe to show to a person.
// Never put personal data, tokens or SQL into either.

export class AppError extends Error {
  /**
   * @param {number} status   HTTP status
   * @param {string} code     stable snake_case identifier, e.g. 'duplicate_claim'
   * @param {string} message  human-readable, safe to display
   * @param {Record<string, unknown>} [details]  ids, enums and numbers only
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const unauthorized = (code = 'not_signed_in', message = 'Sign in to continue.') => new AppError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'You are not allowed to do that.', details) => new AppError(403, code, message, details);
export const notFound = (code = 'not_found', message = 'Not found.') => new AppError(404, code, message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const unprocessable = (code, message, details) => new AppError(422, code, message, details);
export const tooManyRequests = (message = 'Too many requests. Try again shortly.', details) => new AppError(429, 'rate_limited', message, details);

export const isAppError = (e) => e instanceof AppError;
