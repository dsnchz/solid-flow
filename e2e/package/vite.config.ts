import { readFileSync } from "node:fs";
import path from "node:path";

import solidPlugin from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

// The published-package fixture (e2e/package.spec.ts): a production app that
// consumes the BUILT package the way a Vite + @solidjs/vite-plugin app does.
// The plugin resolves the `solid` export condition, so this app compiles the
// shipped JSX build (dist/index/index.jsx) with its own Solid compiler, a
// path neither the library's tests (which compile src/) nor the compiled
// `default` build exercise. The targets come from package.json's export map,
// so the fixture follows whatever the package actually ships.
const root = path.resolve(import.meta.dirname, "../..");
const { exports } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  exports: Record<string, string | Record<string, string>>;
};
const target = (entry: string, condition?: string) => {
  const value = exports[entry];
  const file = typeof value === "string" ? value : value?.[condition ?? "default"];
  if (!file) throw new Error(`package.json exports has no ${entry} ${condition ?? ""}`);
  return path.join(root, file);
};

export default defineConfig({
  root: import.meta.dirname,
  plugins: [solidPlugin()],
  resolve: {
    conditions: ["browser"],
    alias: [
      { find: /^@dschz\/solid-flow\/style\.css$/, replacement: target("./style.css") },
      { find: /^@dschz\/solid-flow$/, replacement: target(".", "solid") },
    ],
  },
  build: {
    target: "esnext",
    outDir: path.join(root, "node_modules/.cache/solid-flow-package-fixture"),
    emptyOutDir: true,
  },
  preview: { port: 3014, strictPort: true },
});
