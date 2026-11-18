---
"@dschz/solid-flow": minor
---

Stylesheets are published under React Flow's and Svelte Flow's paths: `@dschz/solid-flow/style.css` (the full default theme) and the new `@dschz/solid-flow/base.css` (the structural rules with a minimal skin, for apps that bring their own), plus their `./dist/style.css` and `./dist/base.css` forms. The 0.2.x import `@dschz/solid-flow/styles` still works and resolves to `style.css`. `package.json` is exported for tools.

The library stylesheets sit in the `xyflow` cascade layer, as in React Flow 13 and Svelte Flow 2. Any rule of yours outside a layer overrides them regardless of specificity, so restyling no longer needs `!important` or selectors that out-specify the library's. If your own CSS is itself layered, order the layers explicitly, for example `@layer xyflow, app;`.

The package declares `"sideEffects": ["*.css"]`, as React Flow and Svelte Flow do, so bundlers can prune unused modules while keeping a side-effect-only stylesheet import.
