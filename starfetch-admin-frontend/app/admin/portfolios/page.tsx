import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminPortfoliosPage as UnavailablePage } from "@/components/admin/AdminPortfoliosPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminPortfoliosPage } = await import("@/components/admin/demo/AdminPortfoliosPage");
    return <AdminPortfoliosPage />;
  }
  return <UnavailablePage />;
}
