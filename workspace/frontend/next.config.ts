import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for Railway/Docker — start with node .next/standalone/server.js
  // (see railway-start.js). Do not use `next start` with this setting.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  eslint: {
    // Don't fail Railway builds on lint noise
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
};

export default nextConfig;
