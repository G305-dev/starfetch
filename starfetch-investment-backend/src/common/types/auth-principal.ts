import { UserRole } from '@prisma/client';
import { Request } from 'express';

/** Minimal validated identity derived from an access JWT. */
export interface AuthPrincipal {
  userId: string;
  role: UserRole;
  sessionId: string;
}

/** Express request carrying the request ID and (after the guard) principal. */
export interface AuthenticatedRequest extends Request {
  requestId?: string;
  principal?: AuthPrincipal;
}
