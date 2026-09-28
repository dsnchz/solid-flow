import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vitest/config";

// Hydration lane, client half: the jsdom lane's setup with `hydratable: true`
// and the dev runtime (its hydration checks warn on a mismatch and throw when
// hydration would have to create DOM). Hydrates the markup the server half
// (vite.config.hydration-server.ts) wrote. HMR wrappers stay off: they add
// owners and break hydration-id parity (Solid's own hydrate config does the
// same). Run both with `bun run test:hydration`.
export default defineConfig({
  plugins: [solidPlugin({ hot: false, solid: { hydratable: true } })],
  resolve: {
    conditions: ["development", "browser"],
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./setupTests.ts"],
    include: ["src/**/*.hydration.test.{ts,tsx}"],
  },
});
