import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@minute/db"],
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
