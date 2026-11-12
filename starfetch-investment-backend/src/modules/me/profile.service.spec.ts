import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProfileService } from './profile.service';

describe('ProfileService when an authenticated user has no InvestorProfile', () => {
  it('returns the existing safe 404 instead of treating profile absence as an auth failure', async () => {
    const prisma = {
      investorProfile: { findUnique: jest.fn().mockResolvedValue(null) },
    } as any;
    const service = new ProfileService(prisma);

    try {
      await service.getOwn('synthetic-corporate-user-id');
      throw new Error('Expected profile not found.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'NOT_FOUND',
        message: 'Profile not found.',
      });
    }
    expect(prisma.investorProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'synthetic-corporate-user-id' },
      include: { user: { select: { email: true } } },
    });
  });

  it('returns the same safe 404 when an authenticated profileless user tries an update', async () => {
    const prisma = {
      investorProfile: {
        update: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
          'Record to update not found.',
          { code: 'P2025', clientVersion: '5.22.0' },
        )),
      },
    } as any;
    const service = new ProfileService(prisma);

    await expect(service.updateOwn('synthetic-corporate-user-id', { firstName: 'Ada' }))
      .rejects.toMatchObject({ status: 404, response: { code: 'NOT_FOUND' } });
    expect(prisma.investorProfile.update).toHaveBeenCalledWith({
      where: { userId: 'synthetic-corporate-user-id' },
      data: { firstName: 'Ada' },
      include: { user: { select: { email: true } } },
    });
  });
});
