import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestWithId } from '../types/request-with-id';

interface Envelope<T> {
  data: T;
  meta: Record<string, unknown>;
}

/**
 * Uniform success envelope: `{ data, meta }` with request-ID propagation.
 * Handlers return plain payloads; the envelope is applied centrally.
 * (PROPOSED contract convention from the Phase-1 draft.)
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((payload) => {
        const meta: Record<string, unknown> = { requestId: request?.requestId };

        // Pass through already-enveloped payloads without double-wrapping.
        if (payload !== null && typeof payload === 'object' && 'data' in payload) {
          const existing = payload as unknown as { data: unknown; meta?: Record<string, unknown> };
          return { data: existing.data as T, meta: { ...(existing.meta ?? {}), ...meta } };
        }

        return { data: payload, meta };
      }),
    );
  }
}
