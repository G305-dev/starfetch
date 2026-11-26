import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { StaffSection } from "@/components/admin/prepared/StaffSection";
import { PERMISSIONS } from "@/lib/admin-api/contracts";

export const dynamic = "force-dynamic";

/**
 * Staff & Permissions — other staff members' records, roles and permissions.
 *
 * This page is gated by `staff.read`. A staff member's OWN second factor is not
 * here, precisely because that permission would lock out the accounts that most
 * need enrolment: see `/admin/security`, which requires a session but no
 * portfolio permission.
 *
 * The interface is prepared: search, filters, tables, detail panels and
 * confirmation dialogs. The backend contract is not approved, so every action is
 * inert and no staff record is invented.
 */
export default function Page() {
  return (
    <ProtectedPage permission={PERMISSIONS.staffRead}>
      <StaffSection contract="not-approved" />
    </ProtectedPage>
  );
}
