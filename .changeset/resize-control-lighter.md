---
"@dschz/solid-flow": patch
---

`NodeResizer` and `NodeResizeControl` are lighter: no defaults or omit objects, no attribute spread on a control's element unless it is given extra attributes, a plain class string, and a `NodeResizer`'s eight controls read its props directly instead of a merged copy each. At 10k resizable nodes, mount is about 1 s faster and heap on mount about 210 MB lower. Extra attributes still reach every control, and are now also in server-rendered markup.
