import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthenticatedRequest } from '../../../common/types/auth-principal';
import {
  CorporateApplicantContext,
  CorporateApplicantContextService,
} from '../services/corporate-applicant-context.service';

export interface CorporateApplicantRequest extends AuthenticatedRequest {
  corporateApplicant?: CorporateApplicantContext;
}

/**
 * Reusable guard for authenticated Corporate applicant routes.
 * Must run after AccessTokenGuard (session-aware bearer authentication).
 * O2 creation and O3/O11 reads use it; the service still re-proves ownership.
 */
@Injectable()
export class CorporateApplicantGuard implements CanActivate {
  constructor(private readonly contexts: CorporateApplicantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CorporateApplicantRequest>();
    if (!request.principal) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    request.corporateApplicant = await this.contexts.requireVerifiedInvestor(request.principal);
    return true;
  }
}
