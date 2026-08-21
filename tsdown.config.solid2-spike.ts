import { transformAsync } from "@dom-expressions/compiler";
import { defineConfig } from "tsdown";

// P3.0 spike: thin rolldown transform invoking the Solid 2.0 native compiler
// directly (the Phase 3 primary path from .agent/planning/solid-2-migration.md).
const SOLID_BUILT_INS = [
  "For",
  "Show",
  "Switch",
  "Match",
  "Loading",
  "Errored",
  "Repeat",
  "Reveal",
  "Portal",
  "Dynamic",
];

const solidNativeCompiler = () => ({
  name: "solid-2-native-compiler",
  transform: {
    filter: { id: /\.tsx$/ },
    async handler(code: string, id: string) {
      const result = await transformAsync(code, {
        moduleName: "@solidjs/web",
        generate: "dom" as const,
        hydratable: false,
        dev: false,
        wrapConditionals: true,
        builtIns: SOLID_BUILT_INS,
        filename: id,
        sourceMap: true,
      });
      return { code: result.code ?? "", map: result.map };
    },
  },
});

export default defineConfig({
  entry: { spike: "src/components/container/Panel.tsx" },
  outDir: "dist-spike",
  platform: "neutral",
  format: "esm",
  dts: false,
  alias: { "~": "./src" },
  plugins: [solidNativeCompiler()],
});
