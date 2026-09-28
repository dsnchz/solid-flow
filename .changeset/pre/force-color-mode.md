---
"@dschz/solid-flow": minor
---

Color scheme is now CSS-only, as in React Flow 13 and Svelte Flow 2. The flow follows the OS preference by default through `color-scheme` and `light-dark()`, so server-rendered markup and the first paint already match it with no client-side switch.

Breaking changes:

- `colorMode` and `colorModeSSR` are replaced by `forceColorMode?: "light" | "dark"`. Leave it unset to follow the OS (the old `colorMode="system"`); set it to force a scheme (the old `colorMode="light"` / `"dark"`). `colorModeSSR` has no replacement: the server no longer has to guess.
- A `data-theme="light" | "dark"` attribute on an ancestor (for example `<html>`) forces the scheme page-wide; `forceColorMode` wins over it.
- `useColorMode` and `flow.colorMode` are removed. The flow no longer resolves the scheme in JavaScript; code that needs it can read `matchMedia("(prefers-color-scheme: dark)")` directly.
