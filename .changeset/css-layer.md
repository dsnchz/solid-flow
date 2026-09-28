---
"@dschz/solid-flow": minor
---

The library stylesheets now sit in the `xyflow` cascade layer, as in React Flow 13 and Svelte Flow 2. Any rule of yours outside a layer overrides them regardless of specificity, so restyling no longer needs `!important` or selectors that out-specify the library's. If your own CSS is itself layered, order the layers explicitly, for example `@layer xyflow, app;`.
