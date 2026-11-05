import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: process.env.SEKA_STANDALONE === "1" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: false,
  experimental: {
    // The simulated access gate renders after mount; validate only explicit opt-ins.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    root: path.resolve(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
