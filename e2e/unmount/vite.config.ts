import solidPlugin from "@solidjs/vite-plugin";
import path from "path";
import { defineConfig } from "vite";

// The unmount-retention fixture (e2e/unmount.spec.ts), built for PRODUCTION:
// solid-js dev builds keep references for their diagnostics, which would
// retain an unmounted tree whatever the library does.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [solidPlugin()],
  resolve: {
    conditions: ["browser"],
    alias: { "@": path.resolve(import.meta.dirname, "../../src") },
  },
  build: {
    target: "esnext",
    outDir: path.resolve(
      import.meta.dirname,
      "../../node_modules/.cache/solid-flow-unmount-fixture",
    ),
    emptyOutDir: true,
  },
  preview: { port: 3012, strictPort: true },
});
