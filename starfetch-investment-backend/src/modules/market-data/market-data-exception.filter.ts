import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { RequestWithId } from '../../common/types/request-with-id';

/**
 * Controller-scoped filter for the public market snapshot. The expected,
 * curated 503 outcomes (disabled / temporarily unavailable) are written with
 * the standard error envelope but WITHOUT the global filter's error-level
 * stack-trace logging, so a disabled public homepage endpoint cannot flood
 * logs. Every other exception is delegated unchanged to AllExceptionsFilter.
 */
@Catch()
export class MarketDataExceptionFilter extends AllExceptionsFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException && exception.getStatus() === HttpStatus.SERVICE_UNAVAILABLE) {
      const body = exception.getResponse() as { code?: unknown; message?: unknown; context?: unknown };
      if (body?.code === ERROR_CODES.FEATURE_UNAVAILABLE || body?.code === ERROR_CODES.SERVICE_UNAVAILABLE) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest<RequestWithId>();
        ctx.getResponse<Response>().status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: {
            code: body.code,
            message: typeof body.message === 'string' ? body.message : 'Market data is not available.',
            ...(body.context && typeof body.context === 'object' ? { context: body.context } : {}),
            requestId: request?.requestId ?? 'unavailable',
          },
        });
        return;
      }
    }
    super.catch(exception, host);
  }
}
