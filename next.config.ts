import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use standalone output when containerized (e.g. Dockerfile sets OUTPUT_STANDALONE=true)
  output: process.env.OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // PGlite ships WASM + data files that must not be bundled (local dev / demo database).
  serverExternalPackages: ["@electric-sql/pglite", "pdfkit"],
};

export default nextConfig;
