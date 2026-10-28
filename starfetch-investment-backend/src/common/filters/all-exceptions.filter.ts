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
    /** Safe, client-presentable extra context (e.g. EMAIL_NOT_VERIFIED hint). */
    context?: Record<string, unknown>;
    requestId: string;
  };
}

/**
 * Centralized safe error handling.
 * Guarantees the stable error envelope, attaches the request ID, and never
 * leaks stack traces, secrets, database errors, filesystem paths or internals.
 * HttpExceptions may carry an explicit `{ code, message, context? }` body to
 * use the safe, curated API error codes beyond the status-code defaults.
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
    let context: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = errorCodeForStatus(status);

      const explicit = extractExplicitCode(exception);
      if (explicit.code) code = explicit.code;
      if (explicit.context) context = explicit.context;

      if (status === HttpStatus.BAD_REQUEST && !explicit.message) {
        code = explicit.code ?? ERROR_CODES.VALIDATION_FAILED;
        fields = toFieldErrors(exception);
        message = 'One or more fields require attention.';
      } else if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
        message = explicit.message ?? safeClientMessage(exception);
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
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(context ? { context } : {}),
        requestId,
      },
    };
    response.status(status).json(body);
  }
}

/**
 * Pulls an explicitly curated `{ code, message, context }` payload out of an
 * HttpException body, when the application code provided one. Only object
 * bodies shaped like our curated contract are honoured.
 */
function extractExplicitCode(exception: HttpException): {
  code?: string;
  message?: string;
  context?: Record<string, unknown>;
} {
  const response = exception.getResponse();
  if (!response || typeof response !== 'object') return {};
  const body = response as { code?: unknown; message?: unknown; context?: unknown };
  const code = typeof body.code === 'string' ? body.code : undefined;
  const message = typeof body.message === 'string' ? body.message : undefined;
  const context =
    body.context && typeof body.context === 'object'
      ? (body.context as Record<string, unknown>)
      : undefined;
  return { code, message, context };
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
