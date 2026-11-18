import { AdminInvestmentsPage as UnavailablePage } from "@/components/admin/AdminInvestmentsPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminInvestmentsPage } = await import("@/components/admin/demo/AdminInvestmentsPage");
    return <AdminInvestmentsPage />;
  }
  return <UnavailablePage />;
}
