import type { NextConfig } from "next";

// Next.js settings. We tell Vercel to ship the db/ folder (schema + seed SQL + cached routes)
// with the API functions, because the "reset demo" button re-runs those SQL files.
const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/**": ["./db/**"] },
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
