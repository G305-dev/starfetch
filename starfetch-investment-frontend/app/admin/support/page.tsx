import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { SupportComplaints } from "@/components/admin/prepared/OperationsSections";
import { PERMISSIONS } from "@/lib/admin-api/contracts";

export const dynamic = "force-dynamic";

/**
 * SupportComplaints.
 *
 * The interface is fully prepared: search, filters, tables, detail panels,
 * forms and confirmation dialogs. The backend contract is not approved, so
 * every action is inert and no record is invented.
 */
export default function Page() {
  return (
    <ProtectedPage permission={PERMISSIONS.supportRead}>
      <SupportComplaints contract="not-approved" />
    </ProtectedPage>
  );
}
