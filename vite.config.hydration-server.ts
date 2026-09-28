import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vitest/config";

// Hydration lane, server half: the SSR lane's setup (vite.config.ssr.ts) with
// `hydratable: true`, so the markup carries hydration keys. Renders the
// scenarios in src/components/__tests__/hydration and writes their markup
// for the client half (vite.config.hydration.ts). Run both with
// `bun run test:hydration`. Dev server builds, so the runtime's server checks
// run (the server half fails on any warning, SERVER_WRITE included).
export default defineConfig({
  plugins: [solidPlugin({ solid: { generate: "ssr", hydratable: true } })],
  resolve: {
    alias: [
      {
        find: /^@solidjs\/web$/,
        replacement: path.resolve(
          import.meta.dirname,
          "node_modules/@solidjs/web/dist/server.dev.js",
        ),
      },
      {
        find: /^solid-js$/,
        replacement: path.resolve(import.meta.dirname, "node_modules/solid-js/dist/server.dev.js"),
      },
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.hydration.server.test.{ts,tsx}"],
    server: {
      deps: {
        inline: [/solid-js/, /@solidjs/, /@solid-primitives/, /@xyflow/],
      },
    },
  },
});
