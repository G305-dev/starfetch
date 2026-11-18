import { AdminTransactionsPage as UnavailablePage } from "@/components/admin/AdminTransactionsPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminTransactionsPage } = await import("@/components/admin/demo/AdminTransactionsPage");
    return <AdminTransactionsPage />;
  }
  return <UnavailablePage />;
}
