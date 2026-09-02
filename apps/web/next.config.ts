import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone requires symlinks (fine in Linux containers; fails on Windows
  // without admin). Docker builds set NEXT_OUTPUT_STANDALONE=1.
  output: process.env.NEXT_OUTPUT_STANDALONE === "1" ? "standalone" : undefined,
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
