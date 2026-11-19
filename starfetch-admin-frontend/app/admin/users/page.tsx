import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminUsersPage as UnavailablePage } from "@/components/admin/AdminUsersPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminUsersPage } = await import("@/components/admin/demo/AdminUsersPage");
    return <AdminUsersPage />;
  }
  return <UnavailablePage />;
}
