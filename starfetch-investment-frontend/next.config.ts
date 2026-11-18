import type { NextConfig } from "next";

const backendApiOrigin = process.env.BACKEND_API_ORIGIN?.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async rewrites() {
    if (!backendApiOrigin) return [];
    return [{
      source: "/api/v1/:path*",
      destination: `${backendApiOrigin}/api/v1/:path*`,
    }];
  },
};

export default nextConfig;
