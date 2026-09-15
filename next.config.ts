import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright uses 127.0.0.1 while the local preview is normally opened as
  // localhost. Next's development cross-origin guard otherwise blocks the
  // client bundle/HMR request and leaves the test page server-rendered only.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
