import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CorporateApplicantContextService } from '../services/corporate-applicant-context.service';
import { CorporateApplicantGuard } from './corporate-applicant.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CorporateApplicantGuard', () => {
  it('attaches verified context derived from the access-token principal', async () => {
    const contexts = {
      requireVerifiedInvestor: jest.fn().mockResolvedValue({
        initiatingUserId: '11111111-1111-4111-8111-111111111111',
        role: UserRole.INVESTOR,
      }),
    } as unknown as CorporateApplicantContextService;
    const guard = new CorporateApplicantGuard(contexts);
    const request = {
      principal: {
        userId: '11111111-1111-4111-8111-111111111111',
        role: UserRole.INVESTOR,
        sessionId: '22222222-2222-4222-8222-222222222222',
      },
    };

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(contexts.requireVerifiedInvestor).toHaveBeenCalledWith(request.principal);
    expect(request).toHaveProperty('corporateApplicant.initiatingUserId', request.principal.userId);
  });

  it('fails closed when AccessTokenGuard did not attach a principal', async () => {
    const contexts = { requireVerifiedInvestor: jest.fn() } as unknown as CorporateApplicantContextService;
    const guard = new CorporateApplicantGuard(contexts);
    await expect(guard.canActivate(makeContext({}))).rejects.toMatchObject({ status: 401 });
    expect(contexts.requireVerifiedInvestor).not.toHaveBeenCalled();
  });
});
