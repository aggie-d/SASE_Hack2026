import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is required for Docker builds, but must be disabled on Vercel
  // to avoid the 'ENOENT: next-server.js.nft.json' build failure.
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
