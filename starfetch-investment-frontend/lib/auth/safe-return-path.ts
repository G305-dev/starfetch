/**
 * Returns a same-origin application path that is safe to hand to Next router
 * navigation after login. The input is untrusted because it comes from a query
 * parameter. Invalid values deliberately fall back to the account-type default.
 */
const RETURN_PATH_ORIGIN = "https://starfetch-return-path.invalid";
const blockedPaths = new Set([
  "/login",
  "/register/individual/verify-email",
  "/register/individual/verify-email/success",
]);

export function getSafeReturnPath(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  if (!value.startsWith("/") || value.startsWith("//") || /[\u0000-\u001F\u007F\\]/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value, RETURN_PATH_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== RETURN_PATH_ORIGIN || !parsed.pathname.startsWith("/")) return null;

  let decodedPathname = parsed.pathname;
  try {
    // Reject slash/backslash smuggling even if an intermediary/router performs
    // more than one URL decode. A small bounded loop avoids unbounded work.
    for (let index = 0; index < 4 && decodedPathname.includes("%"); index += 1) {
      decodedPathname = decodeURIComponent(decodedPathname);
    }
  } catch {
    return null;
  }
  // Reject encoded protocol-relative and backslash variants before routing.
  if (decodedPathname.startsWith("//") || decodedPathname.includes("\\") || /[\u0000-\u001F\u007F]/.test(decodedPathname)) return null;
  if (blockedPaths.has(parsed.pathname)) return null;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
