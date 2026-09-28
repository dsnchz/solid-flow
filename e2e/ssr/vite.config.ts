import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vite";

// SSR smoke app for e2e/ssr.spec.ts: @solidjs/vite-plugin's start mode with
// `ssr: true` — the dev server streams the server render of App.tsx for page
// requests and injects the client entry that hydrates it (no hand-written
// entries or server). The app imports the library from source.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [solidPlugin({ start: { app: "./App.tsx" }, ssr: true })],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../../src") },
  },
  server: { port: 3020, strictPort: true },
});
