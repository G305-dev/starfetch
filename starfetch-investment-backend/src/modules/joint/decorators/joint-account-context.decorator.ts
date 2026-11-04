import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JointAccountContext } from '../guards/joint-membership.guard';

/**
 * Injects the membership-verified joint account context populated by
 * {@link JointMembershipGuard}. Controllers must NEVER fall back to
 * body/query/path account identifiers directly — only this context is
 * authorized.
 */
export const JointAccount = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JointAccountContext => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ jointContext?: JointAccountContext }>();
    if (!req.jointContext) {
      // Guard was not run on this route — programming error, fail closed.
      throw new Error(
        'JointAccount context missing — JointMembershipGuard must run first.',
      );
    }
    return req.jointContext;
  },
);
