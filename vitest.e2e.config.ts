import path from "path";
import { fileURLToPath } from "url";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
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
    include: ["src/**/*.e2e.test.ts"],
    setupFiles: [
      "@mavenagi/apps-core-dev/knowledge/inngest/vitest-setup",
      "./src/test-setup/neve.ts",
    ],
    testTimeout: 30000,
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
