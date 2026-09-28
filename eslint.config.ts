import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
import { importX } from "eslint-plugin-import-x";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import solid from "eslint-plugin-solid/configs/v2";
import globals from "globals";
import tseslint, { type CompatiblePlugin } from "typescript-eslint";

// eslint-plugin-solid types its rules as @typescript-eslint/utils RuleModules,
// which declare context methods ESLint's own Plugin type no longer has
// (getScope, getAncestors, ...), so defineConfig rejects the plugin as typed.
// CompatiblePlugin is the type typescript-eslint gives its own plugin for the
// same reason; this is an upcast, not a cast.
const solidPlugin: CompatiblePlugin = solid.plugins.solid;

export default defineConfig(
  {
    // config with just ignores is the replacement for `.eslintignore`
    ignores: [
      ".agent/**",
      "**/build/**",
      "**/coverage/**",
      "**/dist/**",
      "**/node_modules/**",
      "tmp/**",
      ".benchmarks/**",
      "playground/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.strict,
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: "module",
        project: "./tsconfig.json",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: { solid: solidPlugin },
    settings: solid.settings,
    rules: {
      ...solid.rules,
      // As in the plugin's `typescript` config: undefined identifiers in JSX
      // are TypeScript's to report.
      "solid/jsx-no-undef": ["error", { typescriptEnabled: true }],
      "solid/reactivity": [
        "warn",
        {
          // Functions whose callback / accessor arguments run in a tracked
          // or called scope: `dynamic` (@solidjs/web) tracks its source;
          // clientOnlySetup runs its callback synchronously; spreadOnDemand
          // and propGetters read their accessor inside an effect / getters.
          customReactiveFunctions: ["dynamic", "clientOnlySetup", "spreadOnDemand", "propGetters"],
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-namespace": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Runtime import cycles (type-only imports are exempt): in a cycle, the
    // evaluation order decides whether a binding is initialized when a module
    // body reads it, which left the server's built-in edge map holding
    // `undefined` (7953f89). A value import used only in a type position
    // still counts, so write it `import type`.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "import-x": importX },
    settings: {
      // Without these, import-x builds export maps for .js files only and
      // silently skips every TypeScript module (no cycle is ever found).
      "import-x/extensions": [".ts", ".tsx"],
      "import-x/parsers": { "@typescript-eslint/parser": [".ts", ".tsx"] },
      "import-x/resolver-next": [createTypeScriptImportResolver({ project: "./tsconfig.json" })],
    },
    rules: {
      "import-x/no-cycle": "error",
    },
  },
  {
    // Tests read store state imperatively in assertions and pass
    // never-written stores / signals as inputs that mirror what the library
    // receives in production: both rules would flag the test's purpose.
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "solid/reactivity": "off",
      "solid/no-unused-signal": "off",
    },
  },
);
