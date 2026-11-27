import type { NextConfig } from "next";

const backendApiOrigin = process.env.BACKEND_API_ORIGIN?.replace(/\/+$/, "");

/**
 * GENERIC API REWRITE — with the staff API carved out.
 *
 * `/api/v1/:path*` forwards browser requests to the NestJS backend. That is how
 * the investor portal talks to its API, and it must keep working.
 *
 * The gap: `:path*` is greedy. Once David builds `/api/v1/admin/*` on the same
 * backend, this single rewrite would forward the RAW STAFF API through the public
 * frontend origin — no BFF, no staff session check, no hostname isolation. The
 * admin gateway exists precisely to prevent that.
 *
 * Two independent guards, because this is the one place where a single missed
 * check exposes everything behind it:
 *
 *  1. HERE — the rewrite above matches `/api/v1/:path*` as one segment-prefixed
 *     pattern. Next.js rewrite sources are matched in order, and a `beforeFiles`
 *     rewrite can be short-circuited by putting a non-matching rule FIRST. We add
 *     an explicit deny-shaped rule for the admin family that sends it to a
 *     non-existent internal path, so it 404s rather than reaching the backend.
 *  2. In middleware and in lib/admin/host-policy.ts — both refuse the same path
 *     independently of the rewrite.
 *
 * Guard 1 alone would be enough for the rewrite; it is not enough on its own
 * because rewrites are configuration, and a future edit could drop it. The
 * hostname policy does not depend on this file at all.
 */
function buildRewrites() {
  if (!backendApiOrigin) return [];

  return {
    // `beforeFiles` runs before the filesystem and before the generic rewrite
    // below, which is what lets the denial take precedence over `:path*`.
    beforeFiles: [
      {
        // The staff API family, in every spelling that could reach the backend.
        source: "/api/v1/admin",
        destination: "/404",
      },
      {
        source: "/api/v1/admin/:path*",
        destination: "/404",
      },
    ],
    // `afterFiles` holds the real forwarding rule. It is only reached for paths
    // that survived `beforeFiles`, so `/api/v1/admin/*` never arrives here.
    afterFiles: [
      {
        source: "/api/v1/:path*",
        destination: `${backendApiOrigin}/api/v1/:path*`,
      },
    ],
  };
}

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    return buildRewrites();
  },
};

export default nextConfig;
