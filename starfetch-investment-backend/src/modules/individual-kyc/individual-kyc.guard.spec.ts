import { ExecutionContext, HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { IndividualKycGuard } from './individual-kyc.guard';

describe('IndividualKycGuard', () => {
  const contextFor = (principal: any) => ({
    switchToHttp: () => ({ getRequest: () => ({ principal }) }),
  } as unknown as ExecutionContext);

  it('excludes a Corporate INVESTOR account without an Individual InvestorProfile', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: UserRole.INVESTOR, investorProfile: null }) } } as any;
    const guard = new IndividualKycGuard(prisma);
    await expect(guard.canActivate(contextFor({ userId: 'corporate-user', role: UserRole.INVESTOR }))).rejects.toBeInstanceOf(HttpException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'corporate-user' }, select: { role: true, investorProfile: { select: { id: true } } } });
  });

  it('requires the investor role and an authenticated principal', async () => {
    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new IndividualKycGuard(prisma);
    await expect(guard.canActivate(contextFor(undefined))).rejects.toMatchObject({ status: 401 });
    await expect(guard.canActivate(contextFor({ userId: 'staff', role: UserRole.STAFF }))).rejects.toMatchObject({ status: 403 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
