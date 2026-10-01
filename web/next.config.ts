import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets a `cloudflared tunnel` hostname load dev assets for phone testing (docs/wifi-local-dev.md).
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
