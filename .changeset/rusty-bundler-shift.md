---
"@dschz/solid-flow": patch
---

Migrate the build pipeline from tsup to tsdown (Rolldown). The published artifacts keep the same shape and paths — Solid-compiled ESM, a JSX-preserved `.jsx` entry for the `solid` export condition, type declarations, and the stylesheet — with `console.*`/`debugger` still stripped from production builds. `babel-preset-solid` is pinned to 1.9.6 so the compiled output stays compatible with the full `solid-js >=1.8.0` peer range.
