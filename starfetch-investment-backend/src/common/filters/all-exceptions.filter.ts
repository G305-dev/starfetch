import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES, errorCodeForStatus } from '../errors/error-codes';
import { RequestWithId } from '../types/request-with-id';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
    requestId: string;
  };
}

/**
 * Centralized safe error handling.
 * Guarantees the stable error envelope, attaches the request ID, and never
 * leaks stack traces, secrets, database errors, filesystem paths or internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request?.requestId ?? 'unavailable';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected error occurred.';
    let fields: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = errorCodeForStatus(status);

      if (status === HttpStatus.BAD_REQUEST) {
        code = ERROR_CODES.VALIDATION_FAILED;
        fields = toFieldErrors(exception);
        message = 'One or more fields require attention.';
      } else if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
        message = safeClientMessage(exception);
      }
      // 5xx responses keep the generic message — internals are logged, never sent.
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] Unhandled error`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorEnvelope = {
      error: { code, message, ...(fields ? { fields } : {}), requestId },
    };
    response.status(status).json(body);
  }
}

/** Safe 4xx message without leaking server internals. */
function safeClientMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    const message = (response as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.length > 0) return String(message[0]);
    const error = (response as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return exception.message;
}

/** Converts ValidationPipe messages into the stable `fields` map. */
function toFieldErrors(exception: HttpException): Record<string, string> | undefined {
  const response = exception.getResponse();
  if (!response || typeof response !== 'object') return undefined;
  const message = (response as { message?: unknown }).message;
  if (!Array.isArray(message)) return undefined;

  const fields: Record<string, string> = {};
  for (const item of message) {
    if (typeof item !== 'string') continue;
    const separator = item.indexOf(' ');
    const key = separator > 0 ? item.slice(0, separator) : 'request';
    fields[key] = item;
  }
  return Object.keys(fields).length > 0 ? fields : undefined;
}
