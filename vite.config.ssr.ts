import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vitest/config";

// SSR test lane: compiles Solid components with `generate: "ssr"` and runs in a
// plain node environment (no DOM), so renderToString exercises the real
// server-rendering path. Kept separate from the jsdom suite in vite.config.ts.
export default defineConfig({
  plugins: [solidPlugin({ solid: { generate: "ssr", hydratable: false } })],
  resolve: {
    // Pin the server builds explicitly for this lane so inlined modules resolve
    // consistently (see the 1.x lane history: browser-conditioned inlining)
    alias: [
      {
        find: /^@solidjs\/web$/,
        replacement: path.resolve(__dirname, "node_modules/@solidjs/web/dist/server.js"),
      },
      {
        find: /^solid-js$/,
        replacement: path.resolve(__dirname, "node_modules/solid-js/dist/server.js"),
      },
      { find: "~", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.ssr.test.{ts,tsx}"],
    server: {
      // inline everything solid-adjacent so the server-build aliases above
      // apply to the whole module graph (no mixed browser/server instances)
      deps: {
        inline: [/solid-js/, /@solidjs/, /@solid-primitives/, /@xyflow/],
      },
    },
  },
});
