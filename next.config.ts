import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Builds a small self-contained server, perfect for Docker on Vultr.
  output: "standalone",
  serverExternalPackages: ["sharp"],
  // Lets the browser show the same SOL → $ rate as the server.
  env: { NEXT_PUBLIC_SOL_USD_RATE: process.env.SOL_USD_RATE || "150" },
};

export default nextConfig;
