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
    alias: { "@": "./src" },
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
            const match = /^@import\s+"(.+)";\s*$/.exec(line.trim());
            if (match) {
              const target = join(dirname(file), match[1]!);
              parts.push(`/* ${relative(".", target)} */`, await inlineCss(target));
            } else {
              parts.push(line);
            }
          }
          return parts.join("\n");
        };

        await mkdir("dist/styles", { recursive: true });
        const bundled = await inlineCss("src/styles/style.css");
        if (bundled.includes("@import")) {
          throw new Error("dist/styles/index.css still contains @import after inlining");
        }
        await writeFile("dist/styles/index.css", bundled);
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
      outExtensions: () => ({ js: ".jsx" }),
    },
  ];
});
