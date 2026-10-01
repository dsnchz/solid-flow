---
"@dschz/solid-flow": patch
---

`NodeResizeControl` (eight per `NodeResizer`) is lighter: no defaults or omit objects, no attribute spread on its element unless it is given extra attributes, and a plain class string. At 10k resizable nodes, mount is about 0.8 s faster and heap on mount about 118 MB lower. Extra attributes still reach the element, and are now also in server-rendered markup.
