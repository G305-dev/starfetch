import type { ReactNode } from "react";
import { RequireAccountContext } from "@/components/auth/RequireIndividualAuth";
import { JointAccountProvider } from "@/components/joint/JointAccountProvider";

/**
 * Joint views require JOINT context, which the backend derives from an actual
 * Joint membership. An Individual investor without a membership therefore
 * cannot enter the portal by URL — but can still start an application at
 * /register/joint, which is guarded by INDIVIDUAL context instead.
 */
export default function JointLayout({ children }: { children: ReactNode }) {
  return <RequireAccountContext context="JOINT"><JointAccountProvider>{children}</JointAccountProvider></RequireAccountContext>;
}
