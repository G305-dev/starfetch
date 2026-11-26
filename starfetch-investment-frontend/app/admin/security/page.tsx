import type { Metadata } from "next";
import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { StaffSecurity } from "@/components/admin/prepared/StaffSecurity";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Security | Starfetch Admin Portal",
  description: "Your own second factor, recovery codes and staff session.",
  robots: { index: false, follow: false },
};

/**
 * MY SECURITY — a staff member's own MFA and session controls.
 *
 * Deliberately NOT under `/admin/staff`, and deliberately NOT permission-gated.
 *
 * Two separate corrections are answered by this route existing at all:
 *
 *  1. `/admin/staff` requires `staff.read`. A staff member without it could not
 *     reach their own enrolment, recovery codes or reauthentication — exactly the
 *     people who most need them.
 *  2. It is not a nineteenth section. It is not in the sidebar taxonomy, not in
 *     the 18-section inventory, and not counted by the consolidation check. It is
 *     an account-level concern reachable from the account footer, the same way a
 *     password change is not a "section".
 *
 * `ProtectedPage` is rendered without a permission argument: a verified staff
 * session is required, portfolio authority is not.
 */
export default function Page() {
  return (
    <ProtectedPage>
      <StaffSecurity contract="not-approved" />
    </ProtectedPage>
  );
}
