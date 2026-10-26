import { ERROR_DEFINITIONS, ErrorCode } from './error-codes';

/** Details are returned to the client, so they must never contain secrets or personal data. */
export type ErrorDetails = Record<string, string | number | boolean | null | string[]>;

/**
 * The only exception type application code should throw for expected failures.
 * Anything else reaching the exception filter is reported as INTERNAL_ERROR without details.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetails | undefined;

  constructor(code: ErrorCode, message?: string, details?: ErrorDetails) {
    const definition = ERROR_DEFINITIONS[code];
    super(message ?? definition.message);
    this.name = 'AppError';
    this.code = code;
    this.status = definition.status;
    this.details = details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
