import type { NextConfig } from "next";
import { isAdminDemoEnvironment } from "./lib/admin-demo-mode";

// Public, non-secret build switch. Preview must also pass the runtime server gate.
// This lets normal production builds eliminate unused demo modules and fixtures.
const nextConfig: NextConfig = {
  devIndicators: false,
  env: { ADMIN_DEMO_BUILD: isAdminDemoEnvironment() ? "1" : "0" },
};
export default nextConfig;
