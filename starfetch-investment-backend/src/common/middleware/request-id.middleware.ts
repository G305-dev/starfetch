import { NextFunction, Response } from 'express';
import { randomUUID } from 'crypto';
import { RequestWithId } from '../types/request-with-id';

/** Accept only a conservative shape for client-supplied correlation IDs. */
const SAFE_INCOMING_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{7,99}$/;

/**
 * Request/correlation ID middleware.
 *
 * Registered as a ROOT-LEVEL global middleware in `app.setup.ts` — before the
 * global `/api/v1` route prefix — so EVERY incoming request receives a usable
 * ID: `/`, `/api/v1/*`, valid routes, unknown routes, unsupported methods and
 * all error responses. (A Nest `forRoutes('*')` middleware would be scoped
 * under the global prefix and miss root-level requests.)
 */
export function requestIdMiddleware(req: RequestWithId, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && SAFE_INCOMING_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}
