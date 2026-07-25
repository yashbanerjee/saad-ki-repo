import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // standalone is for Docker; Railpack uses node_modules + .next directly
  // Keeping it enabled is fine, but tracing root must stay this package.
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
