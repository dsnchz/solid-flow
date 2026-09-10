import { defineConfig, devices } from "@playwright/test";

// Browser E2E gesture harness (reshaped #16). Runs the vite playground on a
// dedicated strict port (the default 3000 auto-increments when busy, which
// would race a concurrently running dev server) and drives it with trusted
// input — XYHandle ignores synthetic JS events, so these gestures exercise
// the real d3/XY* paths that unit tests cannot reach.
export default defineConfig({
  testDir: "./e2e",
  // Perf tooling lives next to the suite but is opt-in: `BENCH=1 bunx
  // playwright test e2e/bench.spec.ts` (against the prod preview on :3010,
  // see .agent/bench) or `e2e/attribution-probe.spec.ts` (dev server,
  // prints rc.7 diagnostics + DEV.attribution.costs()).
  testIgnore: process.env.BENCH
    ? []
    : [
        "**/bench.spec.ts",
        "**/attribution-probe.spec.ts",
        "**/mount-profile.spec.ts",
        "**/mount-repro.spec.ts",
        "**/heap-snapshot.spec.ts",
        "**/drag-profile.spec.ts",
        "**/pan-trace.spec.ts",
      ],
  fullyParallel: true,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3010",
    viewport: { width: 1280, height: 800 },
    // Tracing installs Playwright's snapshot streamer, which pins every DOM
    // element it has seen — off for benches (it fakes retention on unmount).
    trace: process.env.BENCH ? "off" : "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun start -- --port 3010 --strictPort",
    url: "http://localhost:3010",
    reuseExistingServer: true,
    stdout: "ignore",
  },
});
