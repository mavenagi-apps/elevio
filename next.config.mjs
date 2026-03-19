import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@mavenagi/apps-core"],
  turbopack: {
    resolveAlias: {
      "@/settings": "./src/settings.ts",
      "@/knowledge-hooks": "./src/knowledge-hooks.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@/settings": path.resolve(__dirname, "./src/settings.ts"),
      "@/knowledge-hooks": path.resolve(__dirname, "./src/knowledge-hooks.ts"),
    };
    return config;
  },
};
export default nextConfig;
