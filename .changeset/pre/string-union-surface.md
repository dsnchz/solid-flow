---
"@dschz/solid-flow": patch
---

The public types for `Position`, `ConnectionLineType`, `ConnectionMode`, `MarkerType`, `PanOnScrollMode`, `ResizeControlVariant`, and `SelectionMode` are now string unions instead of the nominal upstream enums — `const p: Position = "right"` and literal-typed helpers now typecheck (every prop already accepted literals). The exported member objects are unchanged (`Position.Top` still compiles everywhere and remains required for system-typed node fields like `sourcePosition`).
