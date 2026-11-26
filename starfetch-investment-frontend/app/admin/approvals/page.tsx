import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { ApprovalCenter } from "@/components/admin/prepared/ApprovalCenter";
import { PERMISSIONS } from "@/lib/admin-api/contracts";

export const dynamic = "force-dynamic";

/**
 * ApprovalCenter.
 *
 * The interface is fully prepared: search, filters, tables, detail panels,
 * forms and confirmation dialogs. The backend contract is not approved, so
 * every action is inert and no record is invented.
 */
export default function Page() {
  return (
    <ProtectedPage permission={PERMISSIONS.approvalsRead}>
      <ApprovalCenter contract="not-approved"
        permissions={[]}
        actorStaffId="" />
    </ProtectedPage>
  );
}
