import { NextResponse, type NextRequest } from "next/server";
import { isAdminDemoEnabled } from "@/lib/admin-demo-mode";

/** Fail closed until David's staff-authentication and authorization contract is implemented.
 * This is NOT authentication. The explicitly enabled demo contains synthetic fixtures, makes no API
 * requests, and cannot be enabled in production. Preview requires Vercel Deployment Protection. */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (path === "/admin/login") return NextResponse.next();
  if (isAdminDemoEnabled()) return NextResponse.next();
  return new NextResponse(
    "Admin access is unavailable. Server-side staff authentication and authorization must be connected before these routes can be used.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

export const config = { matcher: ["/admin/:path*"] };
