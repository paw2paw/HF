import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  // Exclude logs folder from file watching to prevent HMR loops
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          "**/node_modules/**",
          "**/logs/**",
          "**/*.jsonl",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;