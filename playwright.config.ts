import { defineConfig, devices } from "@playwright/test";

// Browser E2E gesture harness (reshaped #16). Runs the vite playground on a
// dedicated strict port (the default 3000 auto-increments when busy, which
// would race a concurrently running dev server) and drives it with trusted
// input — XYHandle ignores synthetic JS events, so these gestures exercise
// the real d3/XY* paths that unit tests cannot reach.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3010",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun start -- --port 3010 --strictPort",
    url: "http://localhost:3010",
    reuseExistingServer: true,
    stdout: "ignore",
  },
});
