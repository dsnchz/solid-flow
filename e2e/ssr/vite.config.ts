import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vite";

// SSR smoke app for e2e/ssr.spec.ts: @solidjs/vite-plugin's start mode with
// `ssr: true` — the dev server streams the server render of App.tsx for page
// requests and injects the client entry that hydrates it (no hand-written
// entries or server). The app imports the library from source.
export default defineConfig({
  root: import.meta.dirname,
  // Its own dependency cache: the playground dev server runs alongside it
  // in the e2e suite, and on the shared default (the repo's
  // node_modules/.vite) each server's start re-optimizes the other's deps,
  // so pages loading meanwhile get 504 (Outdated Optimize Dep).
  cacheDir: path.resolve(import.meta.dirname, "../../node_modules/.vite-e2e-ssr"),
  plugins: [solidPlugin({ start: { app: "./App.tsx" }, ssr: true })],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../../src") },
  },
  server: { port: 3020, strictPort: true },
});
