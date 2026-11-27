"use client";

/**
 * STAFF SECTION — staff accounts, roles and permissions.
 *
 * CORRECTED IN PASS 3. This section previously carried a second tab, "My security
 * & MFA", which was wrong for a reason that is easy to miss: the whole route is
 * wrapped in `ProtectedPage permission={PERMISSIONS.staffRead}`. Putting a staff
 * member's own second factor behind `staff.read` meant an account without that
 * permission — typically a new or tightly-scoped account — could not enrol MFA or
 * view recovery codes at all.
 *
 * Enrolment is therefore no longer here. It lives at `/admin/security`, behind a
 * verified staff session but no portfolio permission. This section keeps its
 * single concern and the portal keeps its 18-section structure.
 */

import type { ContractState } from "@/lib/admin/prepared";
import { StaffPermissions } from "./OperationsSections";
import { Card } from "./UI";

export function StaffSection({
  contract,
  initialTab = "accounts",
}: {
  contract: ContractState;
  initialTab?: string;
}) {
  // `initialTab` is retained for signature compatibility with the render tests;
  // with a single view there is nothing to select.
  void initialTab;

  return (
    <div className="space-y-4">
      <StaffPermissions contract={contract} />
    </div>
  );
}
