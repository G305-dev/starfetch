import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { NotificationCenter } from "@/components/admin/prepared/NotificationCenter";
import { PERMISSIONS } from "@/lib/admin-api/contracts";

export const dynamic = "force-dynamic";

/**
 * NotificationCenter.
 *
 * The interface is fully prepared: search, filters, tables, detail panels,
 * forms and confirmation dialogs. The backend contract is not approved, so
 * every action is inert and no record is invented.
 */
export default function Page() {
  return (
    <ProtectedPage permission={PERMISSIONS.notificationsRead}>
      <NotificationCenter contract="not-approved" />
    </ProtectedPage>
  );
}
