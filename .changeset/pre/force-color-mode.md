---
"@dschz/solid-flow": minor
---

Color scheme is now CSS-only, as in React Flow 13 and Svelte Flow 2. The flow follows the OS preference by default through `color-scheme` and `light-dark()`, so server-rendered markup and the first paint already match it with no client-side switch.

Breaking changes:

- `colorMode` and `colorModeSSR` are replaced by `forceColorMode?: "light" | "dark"`. Leave it unset to follow the OS (the old `colorMode="system"`); set it to force a scheme (the old `colorMode="light"` / `"dark"`). `SolidFlow` defaulted to `colorMode="light"` in 0.2.x, so pass `forceColorMode="light"` to keep the old look. `colorModeSSR` has no replacement: the server no longer has to guess.
- A `data-theme="light" | "dark"` attribute on an ancestor (for example `<html>`) forces the scheme page-wide; `forceColorMode` wins over it.
- `useColorMode` is removed. The flow no longer resolves the scheme in JavaScript; code that needs it can read `matchMedia("(prefers-color-scheme: dark)")` directly.
- The `ColorMode` type is `"light" | "dark"`, the type of `forceColorMode`, matching `@xyflow/system` 1.x. It no longer includes `"system"`. `ColorModeClass` is removed; use `ColorMode`.
- The theme colors are CSS `light-dark()` values chosen by the flow container's `color-scheme`, instead of a separate `.solid-flow.dark` override block per stylesheet. The root carries the `light` / `dark` class only when `forceColorMode` sets it, so custom selectors keyed on `.solid-flow.dark` no longer match an OS-driven dark scheme. Overriding a theme variable (`--xy-node-background-color` and friends) works as before.

The container declares `color-scheme`, so browser-drawn controls inside the flow (inputs, scrollbars in custom nodes) follow the flow's theme. The dark scheme uses React Flow's and Svelte Flow's colors: background dots `#555`, lines and cross `#333` (they were all `#777`, noticeably brighter), and edge labels `#141414` with `#f8f8f8` text (they kept a white background in dark mode).
