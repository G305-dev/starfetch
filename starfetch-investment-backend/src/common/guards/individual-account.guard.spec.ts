import { ExecutionContext } from '@nestjs/common';
import { PrimaryAccountType } from '@prisma/client';
import { IndividualAccountGuard } from './individual-account.guard';

describe('IndividualAccountGuard', () => {
  const context = (principal: any) => ({ switchToHttp: () => ({ getRequest: () => ({ principal }) }) } as unknown as ExecutionContext);

  it('denies a Corporate-only session even if an unrelated profile row exists', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ primaryAccountType: PrimaryAccountType.CORPORATE, investorProfile: { id: 'unexpected' } }) } } as any;
    const guard = new IndividualAccountGuard(prisma);
    await expect(guard.canActivate(context({ userId: 'corp', role: 'INVESTOR' }))).rejects.toMatchObject({ status: 403 });
  });

  it('allows an Individual with a live Individual profile (Joint membership does not change primary type)', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ primaryAccountType: PrimaryAccountType.INDIVIDUAL, investorProfile: { id: 'profile' } }) } } as any;
    const guard = new IndividualAccountGuard(prisma);
    await expect(guard.canActivate(context({ userId: 'person', role: 'INVESTOR' }))).resolves.toBe(true);
  });
});
