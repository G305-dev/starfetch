import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/guards/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { InvestorProfileView, ProfileService } from './profile.service';

/**
 * GET/PUT /api/v1/me/profile — investor self-service profile.
 *
 * - Authentication: session-aware AccessTokenGuard (revoked/expired sessions
 *   are rejected immediately).
 * - Authorization: INVESTOR role only (RolesGuard).
 * - Ownership: strictly the authenticated principal's userId — never from the
 *   request body or query string. One investor can never target another's
 *   profile here.
 * - Email is owned by the User record and is read-only on this surface.
 */
@Controller('me/profile')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.INVESTOR)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  async getOwn(@Req() req: AuthenticatedRequest): Promise<{ data: InvestorProfileView }> {
    return { data: await this.profiles.getOwn(req.principal!.userId) };
  }

  @Put()
  async updateOwn(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ data: InvestorProfileView }> {
    if (
      dto.firstName === undefined &&
      dto.lastName === undefined &&
      dto.phone === undefined
    ) {
      throw new BadRequestException('No updatable fields provided.');
    }
    return { data: await this.profiles.updateOwn(req.principal!.userId, dto) };
  }
}
