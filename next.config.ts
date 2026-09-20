import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
  // Static hosts serve /lessons/ more reliably than /lessons.html
  trailingSlash: true,
  typedRoutes: true,
};

export default nextConfig;
