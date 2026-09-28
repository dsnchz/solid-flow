---
"@dschz/solid-flow": minor
---

The `ColorMode` type is now `"light" | "dark"`, the type of `forceColorMode`, matching `@xyflow/system` 1.x. It no longer includes `"system"`: leave `forceColorMode` unset to follow the OS. `ColorModeClass` is removed; use `ColorMode`.
