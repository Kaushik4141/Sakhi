import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";
import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") {
  // Prevent setupDevPlatform from being called multiple times in the same process
  const g = globalThis as unknown as { __devPlatformSetup?: boolean };
  if (!g.__devPlatformSetup) {
    g.__devPlatformSetup = true;
    setupDevPlatform();
  }
}

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
    if (dev && config.watchOptions && config.watchOptions.ignored instanceof RegExp) {
      const source = config.watchOptions.ignored.source;
      const newSource = source.replace("git|next", "git|next|wrangler");
      config.watchOptions = {
        ...config.watchOptions,
        ignored: new RegExp(newSource, config.watchOptions.ignored.flags),
      };
    }
    return config;
  },
};

export default nextConfig;

