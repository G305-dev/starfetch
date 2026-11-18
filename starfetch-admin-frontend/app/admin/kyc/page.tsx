import { AdminKycPage as UnavailablePage } from "@/components/admin/AdminKycPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminKycPage } = await import("@/components/admin/demo/AdminKycPage");
    return <AdminKycPage />;
  }
  return <UnavailablePage />;
}
