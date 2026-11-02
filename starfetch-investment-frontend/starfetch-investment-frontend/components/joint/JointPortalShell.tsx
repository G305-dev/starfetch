import type { ReactNode } from "react";
import { JointHeader } from "./JointHeader";
import { JointSidebar } from "./JointSidebar";

/** Shared structural shell so every joint-account area keeps the same sidebar, header and content alignment. */
export function JointPortalShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f7f9f8] lg:pl-[270px]"><JointSidebar /><div className="min-w-0"><JointHeader /><div className="mx-auto w-full max-w-[1600px] px-5 py-8 sm:px-8 lg:px-8 xl:px-10">{children}</div></div></div>;
}
