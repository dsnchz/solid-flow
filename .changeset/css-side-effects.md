---
"@dschz/solid-flow": patch
---

The stylesheet import is no longer dropped by webpack. The package declared `"sideEffects": false`, which lets webpack (and Rspack) prune a side-effect-only `import "@dschz/solid-flow/styles"` from production builds, leaving the flow unstyled. It now declares `"sideEffects": ["*.css"]`, as React Flow and Svelte Flow do.
