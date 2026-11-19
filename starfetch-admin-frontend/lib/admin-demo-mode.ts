/** Server-side environment gate, shared by middleware and server-rendered pages.
 * This is NOT authentication and cannot verify Vercel Deployment Protection.
 * Preview deployments must be protected separately in the Vercel dashboard.
 */
export function isAdminDemoEnvironment(): boolean {
  if (process.env.ADMIN_DEMO_MODE !== "1" || process.env.VERCEL_ENV === "production") return false;

  const localDevelopment = process.env.NODE_ENV === "development" &&
    (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development");
  const vercelPreview = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview";
  return localDevelopment || vercelPreview;
}

/** The build switch prevents demo bundles in a normal production build. */
export function isAdminDemoEnabled(): boolean {
  return process.env.ADMIN_DEMO_BUILD === "1" && isAdminDemoEnvironment();
}
