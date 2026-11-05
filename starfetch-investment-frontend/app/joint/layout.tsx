import type { ReactNode } from "react";
import { JointPortalAccess } from "@/components/joint/JointPortalAccess";

export default function JointLayout({ children }: { children: ReactNode }) {
  return <JointPortalAccess>{children}</JointPortalAccess>;
}
