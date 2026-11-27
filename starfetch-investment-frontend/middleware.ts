import { NextResponse, type NextRequest } from "next/server";
import { denyHeaders, isRawAdminApiPath, readHostPolicyConfig, resolveHostPolicy } from "@/lib/admin/host-policy";

/**
 * CONSOLIDATED FRONTEND MIDDLEWARE — hostname isolation.
 *
 * Two responsibilities, in this order:
 *
 *  1. Hostname policy (below): decide, from the verified `Host` header, whether
 *     this request may reach the public product or the staff product.
 *  2. Admin fail-closed gate: on the admin host, refuse the portal unless the
 *     staff integration is explicitly enabled and approved.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS DELIBERATELY NOT HERE
 * ---------------------------------------------------------------------------
 *  - No authentication. A cookie's existence is NOT proof of a session. Every
 *    protected page validates the staff session with the backend, and the BFF
 *    gateway re-validates it on every single request. Middleware is bypassable by
 *    design (it only sees matched paths) and is therefore never the boundary.
 *  - No reading of `X-Forwarded-Host`. See lib/admin/host-policy.ts.
 *  - No dev-only bypass. `ADMIN_ALLOW_LOCALHOST` is refused in production by
 *    `readHostPolicyConfig`, and it only ever adds the LOCAL hostname to the
 *    admin allowlist — it does not skip any check.
 *
 * ---------------------------------------------------------------------------
 * AVAILABILITY (the correction that made this file change)
 * ---------------------------------------------------------------------------
 * The previous version was fail-closed for the ENTIRE application: a missing or
 * malformed ADMIN_HOSTNAMES returned 503 on every host, so a staff-portal typo
 * could take the public website and the investor portal offline. That is an
 * availability fault with a security shape it does not need.
 *
 * The two sides are now separated by severity:
 *
 *   PUBLIC_HOSTNAMES missing or invalid  -> 503 everywhere. Fatal, and correctly
 *                                            so: we cannot distinguish an
 *                                            approved hostname from an arbitrary
 *                                            one, so we serve nobody.
 *   ADMIN_HOSTNAMES missing or invalid   -> admin unreachable, public site
 *                                            unaffected. The admin list is
 *                                            emptied, so no request can ever be
 *                                            classified as admin.
 *
 * A missing admin hostname is therefore a NORMAL, SAFE state — it is the state
 * production is in today, before the staff portal is released. It must not be an
 * outage.
 */
export function middleware(request: NextRequest) {
  const { config, problem, fatal } = readHostPolicyConfig();

  const hostHeader = request.headers.get("host");
  const decision = resolveHostPolicy(config, hostHeader, request.nextUrl.pathname);

  if (decision.action === "deny") {
    // 503 only for the fatal configuration faults. An admin-only fault now leaves
    // the public site serving normally and shows up as a 404 on the staff
    // hostname, because with no admin host in the allowlist the request is simply
    // "unknown host" — the same answer a stranger gets.
    const message =
      decision.status === 503 && fatal
        ? "This Starfetch deployment is not configured for this hostname."
        : "Not found";
    // Never echo the reason or the received Host value back to the client: that
    // turns the endpoint into a probe for which hostnames are configured.
    void problem;
    return new NextResponse(message, {
      status: decision.status,
      headers: { ...denyHeaders(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    return NextResponse.redirect(url);
  }

  // --- Generic API rewrite guard -------------------------------------------
  // next.config.ts forwards /api/v1/:path* to the NestJS backend. That rewrite is
  // browser-facing and hostname-agnostic, so on its own it would carry
  // /api/v1/admin/* (once David builds it) straight through on ANY hostname —
  // including the public one. The hostname policy already classifies
  // /api/v1/admin as staff-only, and next.config.ts has a matching rewrite-level
  // guard; this is the third, independent refusal in the same chain.
  if (isRawAdminApiPath(request.nextUrl.pathname)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { ...denyHeaders(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // --- Admin host: portal-specific fail-closed gate -------------------------
  if (decision.host === "admin") {
    // Login must always render so staff can sign in — but it renders DISABLED
    // unless the integration is enabled, so an unconfigured deployment shows an
    // honest "not connected" state rather than a form that cannot work.
    const isLogin = request.nextUrl.pathname === "/admin/login";

    const enabled =
      process.env.ADMIN_STAFF_INTEGRATION_ENABLED === "approved-v1" &&
      process.env.ADMIN_RELEASE_APPROVED === "true" &&
      !!process.env.ADMIN_BACKEND_URL &&
      !!process.env.ADMIN_STAFF_SESSION_COOKIE;

    if (!isLogin && !enabled) {
      return new NextResponse(
        "Admin Portal unavailable until authenticated backend integration and release approvals are complete.",
        {
          status: 503,
          headers: { ...denyHeaders(), "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
  }

  const response = NextResponse.next();
  // Private, non-cacheable admin responses. Set here as well as in next.config
  // headers so an edge cache cannot serve a staff page to anyone else.
  if (decision.host === "admin") {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

/**
 * Match every path, not just `/admin/:path*`.
 *
 * The previous admin-only matcher could not enforce "the public host must not
 * reach staff routes" or "the admin host must not reach investor routes",
 * because it never ran on investor paths. Hostname isolation needs to see every
 * request. Next.js skips static assets and `_next` internally, which is what we
 * want: the admin host must still serve its own JS/CSS bundles.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
