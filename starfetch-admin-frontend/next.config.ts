import type {NextConfig} from 'next';
const securityHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-store, max-age=0',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  headers: async () => [
    {
      source: '/admin/:path*',
      headers: securityHeaders,
    },
    {
      source: '/api/admin-auth/:path*',
      headers: securityHeaders,
    },
    {
      source: '/api/admin-gateway/:path*',
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
