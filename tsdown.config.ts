import { transformAsync } from "@dom-expressions/compiler";
import { defineConfig, type UserConfig } from "tsdown";

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

/**
 * Thin rolldown transform invoking the Solid 2.0 native compiler directly.
 * It rewrites JSX only (to `@solidjs/web` calls) and passes TypeScript through
 * for oxc to strip afterwards. Option shape mirrors @solidjs/vite-plugin's
 * native path (tmp/vite-plugin-solid src/index.ts).
 */
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

export default defineConfig((cli) => {
  const watching = !!cli.watch;

  const shared = {
    outDir: "dist",
    platform: "neutral",
    format: "esm",
    alias: { "~": "./src" },
    // Strip `console.*` and `debugger` in prod builds only. mangle/codegen
    // stay off so the output remains readable.
    minify: watching
      ? false
      : {
          compress: { dropConsole: true, dropDebugger: true },
          mangle: false,
          codegen: false,
        },
  } satisfies UserConfig;

  return [
    // Solid-compiled ESM + type declarations (the `import` condition)
    {
      ...shared,
      entry: { "index/index": "src/index.tsx" },
      dts: true,
      plugins: [solidNativeCompiler()],
      // `copy` treats `to` as a directory, so rename the stylesheet ourselves
      onSuccess: async () => {
        const { mkdir, copyFile } = await import("node:fs/promises");
        await mkdir("dist/styles", { recursive: true });
        await copyFile("src/styles/style.css", "dist/styles/index.css");
      },
    },
    // Type-stripped, JSX-preserved build for the `solid` export condition,
    // so SolidStart/SSR can compile the JSX with the right generate mode
    {
      ...shared,
      entry: { "index/index": "src/index.tsx" },
      dts: false,
      inputOptions: { transform: { jsx: "preserve" } },
      outExtensions: () => ({ js: ".jsx" }),
    },
  ];
});
