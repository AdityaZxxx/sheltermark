import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow the dev server to be reached from any host (e.g. a phone on the same
  // Wi-Fi hitting http://<laptop-lan-ip>:3000). The IP changes per network,
  // so we accept anything rather than hardcoding a specific address.
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;
