import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
    typecheck: {
      enabled: true,
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["src/**/*.e2e.test.{ts,tsx}"],
    },
  },
});

export default mergeConfig(baseConfig, {
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@/settings": path.resolve(__dirname, "./src/settings.ts"),
      "@/knowledge-hooks": path.resolve(
        __dirname,
        "./src/knowledge-hooks.ts",
      ),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.e2e.test.ts", "src/**/*.e2e.test.tsx"],
    setupFiles: ["@mavenagi/apps-core-dev/knowledge/inngest/vitest-setup"],
  },
  ssr: {
    noExternal: [
      "@mavenagi/apps-core",
      "@mavenagi/apps-core-dev",
      "mavenagi",
      "next",
      "cacheable",
      "@keyv/redis",
      "@keyv/compress-gzip",
      "keyv",
      "redis",
      "inngest",
    ],
  },
});
