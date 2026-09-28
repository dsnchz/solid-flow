---
"@dschz/solid-flow": patch
---

`colorMode` now defaults to `'system'`, as documented: a flow without a `colorMode` prop follows the OS color-scheme preference instead of always rendering light. Server rendering is unchanged (the server has no preference to read and renders `colorModeSSR`, default `'light'`). Pass `colorMode="light"` to keep the previous behavior.
