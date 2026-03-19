import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

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
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.e2e.test.ts", "src/**/*.e2e.test.tsx"],
  },
  ssr: {
    noExternal: ["mavenagi", "inngest"],
  },
});
