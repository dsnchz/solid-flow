import path from "path";
import solidPlugin from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

// SSR test lane: compiles Solid components with `generate: "ssr"` and runs in a
// plain node environment (no DOM), so renderToString exercises the real
// server-rendering path. Kept separate from the jsdom suite in vite.config.ts.
export default defineConfig({
  plugins: [solidPlugin({ solid: { generate: "ssr", hydratable: false } })],
  resolve: {
    // vite-plugin-solid inlines solid-js with browser-conditioned resolution even
    // in a node environment, so pin the server builds explicitly for this lane
    alias: [
      {
        find: /^solid-js\/web$/,
        replacement: path.resolve(__dirname, "node_modules/solid-js/web/dist/server.js"),
      },
      {
        find: /^solid-js\/store$/,
        replacement: path.resolve(__dirname, "node_modules/solid-js/store/dist/server.js"),
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
        inline: [/solid-js/, /@solid-primitives/, /@xyflow/],
      },
    },
  },
});
