import { AdminPortfoliosPage as UnavailablePage } from "@/components/admin/AdminPortfoliosPage";

/** Demo modules are imported only in explicitly enabled development mode. */
export default async function Page() {
  if (process.env.NODE_ENV === "development" && process.env.ADMIN_DEMO_MODE === "1") {
    const { AdminPortfoliosPage } = await import("@/components/admin/demo/AdminPortfoliosPage");
    return <AdminPortfoliosPage />;
  }
  return <UnavailablePage />;
}
