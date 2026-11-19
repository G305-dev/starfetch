import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminTransactionsPage as UnavailablePage } from "@/components/admin/AdminTransactionsPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminTransactionsPage } = await import("@/components/admin/demo/AdminTransactionsPage");
    return <AdminTransactionsPage />;
  }
  return <UnavailablePage />;
}
