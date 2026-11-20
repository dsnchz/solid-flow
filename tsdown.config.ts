import { transformAsync } from "@solidjs/compiler";
import { defineConfig, type UserConfig } from "tsdown";

import { stylesheetModule } from "./scripts/jsrStylesheetModule.js";

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

  const minify = (compress: { joinVars?: false; sequences?: false } = {}) =>
    watching
      ? false
      : {
          compress: { dropConsole: true, dropDebugger: true, ...compress },
          mangle: false,
          codegen: false,
        };

  const shared = {
    outDir: "dist",
    platform: "neutral",
    format: "esm",
    alias: { "@": "./src" },
    // Strip `console.*` and `debugger` in prod builds only. mangle/codegen
    // stay off so the output remains readable.
    minify: minify(),
  } satisfies UserConfig;

  return [
    // Solid-compiled ESM + type declarations (the `import` condition)
    {
      ...shared,
      entry: { "index/index": "src/index.ts" },
      dts: true,
      plugins: [solidNativeCompiler()],
      // The stylesheet is a tree of relative `@import`s into src/components,
      // which are NOT shipped — a plain copy publishes dead imports (bug in
      // 0.2.3 / 0.3.0-next.0). Inline the whole tree into one flat file, as
      // the tsup pipeline used to.
      onSuccess: async () => {
        const { mkdir, readFile, writeFile } = await import("node:fs/promises");
        const { dirname, join, relative } = await import("node:path");

        const inlineCss = async (file: string): Promise<string> => {
          const source = await readFile(file, "utf8");
          const parts: string[] = [];
          for (const line of source.split("\n")) {
            // `@import "x.css" layer(name);` inlines x.css inside `@layer name { }`.
            const match = /^@import\s+"(.+)"(?:\s+layer\(([\w-]+)\))?;\s*$/.exec(line.trim());
            if (match) {
              const target = join(dirname(file), match[1]!);
              const inlined = await inlineCss(target);
              const layer = match[2];
              parts.push(
                `/* ${relative(".", target)} */`,
                layer ? `@layer ${layer} {\n${inlined}\n}` : inlined,
              );
            } else {
              parts.push(line);
            }
          }
          return parts.join("\n");
        };

        // style.css (structure + default theme), base.css (structure +
        // minimal theme) and xy-theme.css (base.css + the xyflow theme), as
        // React Flow / Svelte Flow ship them.
        await mkdir("dist/styles", { recursive: true });
        await mkdir("dist/jsr", { recursive: true });
        for (const name of ["style", "base", "xy-theme"]) {
          const out = `dist/styles/${name}.css`;
          const bundled = await inlineCss(`src/styles/${name}.css`);
          if (bundled.includes("@import")) {
            throw new Error(`${out} still contains @import after inlining`);
          }
          await writeFile(out, bundled);
          // JSR exports modules only: its `./<name>.css` is this module
          // (scripts/jsrStylesheetModule.js), the .css file ships beside it.
          const jsr = stylesheetModule(name, bundled);
          await writeFile(`dist/jsr/${name}.css.js`, jsr.js);
          await writeFile(`dist/jsr/${name}.css.d.ts`, jsr.dts);
        }

        // JSR publishes the compiled client build, typed through
        // @ts-self-types: it does not compile Solid's JSX, and a published
        // .tsx reached npm-compat installs with unresolvable `npm:` imports.
        const js = await readFile("dist/index/index.js", "utf8");
        await writeFile("dist/jsr/index.js", `// @ts-self-types="./index.d.ts"\n${js}`);
        await writeFile("dist/jsr/index.d.ts", await readFile("dist/index/index.d.ts", "utf8"));
      },
    },
    // Type-stripped, JSX-preserved build for the `solid` export condition,
    // so SolidStart/SSR can compile the JSX with the right generate mode
    {
      ...shared,
      entry: { "index/index": "src/index.ts" },
      dts: false,
      // Explicit even though tsconfig also says preserve (rolldown warns
      // CONFIGURATION_FIELD_CONFLICT about the override — same value, benign):
      // this build MUST stay JSX-preserved regardless of tsconfig changes,
      // and nothing in the test suite compiles through tsdown to catch drift.
      inputOptions: { transform: { jsx: "preserve" } },
      // The consumer's Solid compiler emits an element's setup before the
      // statement holding its JSX, so a statement must never put JSX after
      // code that JSX reads. The default compress merged NodeWrapper's
      // consts into one `let` ending in the node element, whose click
      // handler was then read before its declaration (crash on load).
      // joinVars merges declarations, sequences merges expression statements.
      minify: minify({ joinVars: false, sequences: false }),
      outExtensions: () => ({ js: ".jsx" }),
    },
  ];
});
