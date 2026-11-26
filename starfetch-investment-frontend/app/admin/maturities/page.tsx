import { ProtectedPage } from "@/components/admin/live/ProtectedPage";
import { MaturityRedemption } from "@/components/admin/prepared/OperationsSections";
import { PERMISSIONS } from "@/lib/admin-api/contracts";

export const dynamic = "force-dynamic";

/**
 * MaturityRedemption.
 *
 * The interface is fully prepared: search, filters, tables, detail panels,
 * forms and confirmation dialogs. The backend contract is not approved, so
 * every action is inert and no record is invented.
 */
export default function Page() {
  return (
    <ProtectedPage permission={PERMISSIONS.maturitiesRead}>
      <MaturityRedemption contract="not-approved" />
    </ProtectedPage>
  );
}
