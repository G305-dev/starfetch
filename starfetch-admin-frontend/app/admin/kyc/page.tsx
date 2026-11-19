import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

export const dynamic = "force-dynamic";
import { AdminKycPage as UnavailablePage } from "@/components/admin/AdminKycPage";

/** Demo modules render only in explicitly enabled development or Vercel Preview. */
export default async function Page() {
  if (process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnabled()) {
    const { AdminKycPage } = await import("@/components/admin/demo/AdminKycPage");
    return <AdminKycPage />;
  }
  return <UnavailablePage />;
}
