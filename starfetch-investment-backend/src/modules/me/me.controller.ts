import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService, SafeUser } from '../auth/auth.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

/**
 * GET /api/v1/me — current-user resource behind the reusable auth guard.
 * Returns only the approved safe projection (never password hashes,
 * normalizedEmail, session/token hashes or internal secrets).
 */
@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @UseGuards(AccessTokenGuard)
  async me(@Req() req: AuthenticatedRequest): Promise<{ data: SafeUser }> {
    const principal = req.principal!;
    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      include: { investorProfile: true },
    });
    if (!user) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { data: this.auth.safeUser(user) };
  }
}
