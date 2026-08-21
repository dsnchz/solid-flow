import { defineConfig } from "tsup";
import * as preset from "tsup-preset-solid";

import pkg from "./package.json";

const generateSolidPresetOptions = (watching: boolean): preset.PresetOptions => ({
  entries: [
    {
      // entries with '.tsx' extension will have `solid` export condition generated
      entry: "src/index.tsx",
      dev_entry: false,
      server_entry: false,
    },
    {
      name: "styles",
      entry: "src/styles/style.css",
      dev_entry: false,
      server_entry: false,
    },
  ],
  drop_console: !watching, // remove all `console.*` calls and `debugger` statements in prod builds
  cjs: false,
});

export default defineConfig((config) => {
  const watching = !!config.watch;
  const solidPresetOptions = generateSolidPresetOptions(watching);
  const parsedOptions = preset.parsePresetOptions(solidPresetOptions, watching);

  const tsupOptions = preset.generateTsupOptions(parsedOptions).map((tsupOption) => ({
    name: pkg.name,
    ...tsupOption,
    // tsup's dts build injects `baseUrl` to resolve the `~/*` path alias, which
    // TypeScript 6 rejects as deprecated (TS5101). Suppress it here so the
    // editor-facing tsconfig stays free of ignoreDeprecations, which editors
    // running a bundled TypeScript 5.x reject.
    dts: tsupOption.dts
      ? {
          ...(typeof tsupOption.dts === "object" ? tsupOption.dts : {}),
          ...(typeof tsupOption.dts === "string" ? { entry: tsupOption.dts } : {}),
          compilerOptions: { ignoreDeprecations: "6.0" },
        }
      : undefined,
  }));

  return tsupOptions;
});
