import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrimaryAccountType } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/** Prevents a Corporate-only identity from using Individual resources. */
@Injectable()
export class IndividualAccountGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.principal) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Authentication required.' });
    const user = await this.prisma.user.findUnique({
      where: { id: req.principal.userId },
      select: { primaryAccountType: true, investorProfile: { select: { id: true } } },
    });
    if (!user || user.primaryAccountType === PrimaryAccountType.CORPORATE || !user.investorProfile) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This resource is not available for this account.' });
    }
    return true;
  }
}
