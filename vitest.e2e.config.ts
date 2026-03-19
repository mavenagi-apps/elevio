import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig, mergeConfig } from "vitest/config";

const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
});

export default mergeConfig(baseConfig, {
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.e2e.test.ts"],
    setupFiles: ["./src/test-setup/neve.ts"],
    testTimeout: 30000,
  },
  ssr: {
    noExternal: ["mavenagi", "inngest"],
  },
});
