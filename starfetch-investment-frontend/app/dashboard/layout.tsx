import type { ReactNode } from "react";
import { RequireAccountContext } from "@/components/auth/RequireIndividualAuth";

/** Covers every Individual portal route under /dashboard in one place. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <RequireAccountContext context="INDIVIDUAL">{children}</RequireAccountContext>;
}
