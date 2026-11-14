import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds a small self-contained server, perfect for Docker on Vultr.
  output: "standalone",
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
