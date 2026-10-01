---
"@dschz/solid-flow": patch
---

The default `MiniMapNode` is lighter per node: no defaults object, a plain class string and its style built in place. At 10k nodes with a `MiniMap` shown, heap on mount drops by about 12 MB.
