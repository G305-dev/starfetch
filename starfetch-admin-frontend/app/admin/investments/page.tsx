import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminInvestmentsPage as UnavailablePage } from "@/components/admin/AdminInvestmentsPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminInvestmentsPage } = await import("@/components/admin/demo/AdminInvestmentsPage");
    return <AdminInvestmentsPage />;
  }
  return <UnavailablePage />;
}
