import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RequestContext } from '../context/request-context';
import { AppError } from '../errors/app-error';
import { ERROR_DEFINITIONS, ErrorCode } from '../errors/error-codes';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'VALIDATION_FAILED',
  415: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

/**
 * Converts every thrown value into the public error envelope. Stack traces, SQL errors and
 * provider responses never reach the client; unexpected errors are logged server-side with the
 * correlation ID and returned as INTERNAL_ERROR.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: unknown }>();
    const requestId =
      RequestContext.correlationId() ?? (typeof request?.id === 'string' ? request.id : undefined);

    const { status, body } = this.toEnvelope(exception, requestId);
    if (status >= 500) {
      this.logger.error(
        {
          err: exception instanceof Error ? exception : new Error(String(exception)),
          code: body.error.code,
        },
        'Request failed',
      );
    }
    if (response.headersSent) {
      return;
    }
    response.status(status).json(body);
  }

  private toEnvelope(
    exception: unknown,
    requestId: string | undefined,
  ): { status: number; body: ErrorEnvelope } {
    if (exception instanceof AppError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details ? { details: exception.details } : {}),
            requestId,
          },
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code: ErrorCode =
        STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'CONFLICT');
      return {
        status,
        body: { error: { code, message: ERROR_DEFINITIONS[code].message, requestId } },
      };
    }
    return {
      status: 500,
      body: {
        error: {
          code: 'INTERNAL_ERROR',
          message: ERROR_DEFINITIONS.INTERNAL_ERROR.message,
          requestId,
        },
      },
    };
  }
}
