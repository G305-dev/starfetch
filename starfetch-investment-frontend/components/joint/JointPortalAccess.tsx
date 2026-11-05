"use client";

import type { ReactNode } from "react";
import { RequireIndividualAuth } from "@/components/auth/RequireIndividualAuth";
import { JointAccountProvider } from "./JointAccountProvider";

/** Joint membership is data-based; there is no separate JOINT auth role. */
export function JointPortalAccess({ children }: { children: ReactNode }) {
  return <RequireIndividualAuth><JointAccountProvider>{children}</JointAccountProvider></RequireIndividualAuth>;
}
