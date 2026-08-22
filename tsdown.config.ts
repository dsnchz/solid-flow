import { defineConfig, type UserConfig } from "tsdown";
import solid from "unplugin-solid/rolldown";

export default defineConfig((cli) => {
  const watching = !!cli.watch;

  const shared = {
    outDir: "dist",
    platform: "neutral",
    format: "esm",
    alias: { "~": "./src" },
    // Parity with tsup-preset-solid: strip `console.*` and `debugger` in prod
    // builds only. mangle/codegen stay off so the output remains readable.
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
      plugins: [solid()],
      // The stylesheet is a tree of relative `@import`s into src/components,
      // which are NOT shipped — a plain copy publishes dead imports (the 0.2.3
      // regression). Inline the whole tree into one flat file, as the tsup
      // pipeline used to.
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
      entry: { "index/index": "src/index.tsx" },
      dts: false,
      inputOptions: { transform: { jsx: "preserve" } },
      outExtensions: () => ({ js: ".jsx" }),
    },
  ];
});
