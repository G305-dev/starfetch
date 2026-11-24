"use client";

import type { ReactNode } from "react";
import { RequireAccountContext } from "@/components/auth/RequireIndividualAuth";
import { JointAccountProvider } from "./JointAccountProvider";

/**
 * Joint membership is data-based; there is no separate JOINT auth role. The
 * backend encodes a real membership as JOINT in `authorizedContexts`, which is
 * what this guard enforces. Retained for existing Joint page imports.
 */
export function JointPortalAccess({ children }: { children: ReactNode }) {
  return <RequireAccountContext context="JOINT"><JointAccountProvider>{children}</JointAccountProvider></RequireAccountContext>;
}
