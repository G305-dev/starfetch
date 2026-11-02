import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ERROR_CODES } from '../errors/error-codes';
import { AuthenticatedRequest } from '../types/auth-principal';
import { ROLES_KEY } from './roles.decorator';

/**
 * Role-based authorization guard (server-side authority — frontend route
 * guards are UX only). Must run AFTER AccessTokenGuard, which attaches the
 * validated principal. Endpoints without @Roles metadata are unaffected.
 * Emits a safe generic 403 — never discloses role internals.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.principal?.role;
    if (!role || !required.includes(role)) {
      throw new HttpException(
        { code: ERROR_CODES.FORBIDDEN, message: 'You do not have access to this resource.' },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
