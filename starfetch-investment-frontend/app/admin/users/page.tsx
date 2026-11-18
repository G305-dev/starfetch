import { AdminUsersPage as UnavailablePage } from "@/components/admin/AdminUsersPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminUsersPage } = await import("@/components/admin/demo/AdminUsersPage");
    return <AdminUsersPage />;
  }
  return <UnavailablePage />;
}
