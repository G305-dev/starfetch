import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InvestorProfile, Prisma, User } from '@prisma/client';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Approved safe profile projection (NO internal/security fields). */
export interface InvestorProfileView {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

function toView(
  profile: InvestorProfile & { user: Pick<User, 'email'> },
): InvestorProfileView {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.user.email, // read-only, owned by User record
    phone: profile.phone,
  };
}

/**
 * Investor self-service profile. Ownership is ALWAYS derived from the
 * authenticated principal — never from request body/query.
 */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwn(userId: string): Promise<InvestorProfileView> {
    const profile = await this.prisma.investorProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!profile) {
      // Data anomaly (registration creates User+Profile atomically) — safe 404.
      throw this.notFound();
    }
    return toView(profile);
  }

  async updateOwn(userId: string, dto: UpdateProfileDto): Promise<InvestorProfileView> {
    const data: Partial<Pick<InvestorProfile, 'firstName' | 'lastName' | 'phone'>> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone; // string or explicit null (clear)

    try {
      const profile = await this.prisma.investorProfile.update({
        where: { userId },
        data,
        include: { user: { select: { email: true } } },
      });
      return toView(profile);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw this.notFound(); // record to update not found — same safe outcome
      }
      throw error;
    }
  }

  private notFound(): HttpException {
    return new HttpException(
      { code: ERROR_CODES.NOT_FOUND, message: 'Profile not found.' },
      HttpStatus.NOT_FOUND,
    );
  }
}
