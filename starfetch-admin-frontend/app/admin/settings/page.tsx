import { AdminSettingsPage as UnavailablePage } from "@/components/admin/AdminSettingsPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminSettingsPage } = await import("@/components/admin/demo/AdminSettingsPage");
    return <AdminSettingsPage />;
  }
  return <UnavailablePage />;
}
