import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminSettingsPage as UnavailablePage } from "@/components/admin/AdminSettingsPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminSettingsPage } = await import("@/components/admin/demo/AdminSettingsPage");
    return <AdminSettingsPage />;
  }
  return <UnavailablePage />;
}
