// The browser only ever talks to this site. Requests to /api/... are forwarded to the NestJS API,
// so there is one public port and no CORS. NOTE: Next bakes this value in at build time.
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
