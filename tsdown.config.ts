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
