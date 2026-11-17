import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class IndividualKycGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new HttpException({ code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' }, HttpStatus.UNAUTHORIZED);
    }
    if (principal.role !== UserRole.INVESTOR) throw this.forbidden();

    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      select: { role: true, investorProfile: { select: { id: true } } },
    });
    // Corporate applicants share INVESTOR auth but intentionally have no
    // InvestorProfile. Role alone therefore never grants Individual KYC access.
    if (!user || user.role !== UserRole.INVESTOR || !user.investorProfile) throw this.forbidden();
    return true;
  }

  private forbidden(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.FORBIDDEN, message: 'Individual KYC is not available for this account.' },
      HttpStatus.FORBIDDEN,
    );
  }
}
