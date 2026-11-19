import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminDashboard as UnavailablePage } from "@/components/admin/AdminDashboard";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminDashboard } = await import("@/components/admin/demo/AdminDashboard");
    return <AdminDashboard />;
  }
  return <UnavailablePage />;
}
