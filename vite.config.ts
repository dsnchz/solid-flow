import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

// We exclude the server directory because we use Bun (not Vitest) to run those tests
const TEST_EXCLUDES = [
  ...configDefaults.exclude,
  "src/index.tsx",
  "src/mocks",
  "public",
  "server",
  "playground/**",
  "tmp/**",
  // SSR tests run in their own node-environment lane (vite.config.ssr.ts)
  "**/*.ssr.test.*",
];
const COVERAGE_EXCLUDE = [...TEST_EXCLUDES, "**/*.test.{ts,tsx}"];

const viteConfig = defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      // Proxy API requests to the backend port in development
      "/api": "http://localhost:8000",
    },
  },
  build: {
    target: "esnext",
  },
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});

const vitestConfig = defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./setupTests.ts"],
    exclude: TEST_EXCLUDES,
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
      exclude: COVERAGE_EXCLUDE,
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);
