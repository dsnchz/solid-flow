---
"@dschz/solid-flow": patch
---

`EdgeReconnectAnchor` renders as one element, the edge label itself, as Svelte Flow's does: the element carries `solid-flow__edge-label transparent solid-flow__edgeupdater solid-flow__edgeupdater-{type}` (plus `nopan` and your `class`), takes `size` as its width and height, and receives your `style` and extra attributes. Before, an edge label wrapped a second element that carried the updater classes, size and an inline `cursor`/`background`/`border`; selectors that reached the updater through the label (`.solid-flow__edge-label > .solid-flow__edgeupdater`) need updating. The updater's `cursor: move` now comes from the stylesheet. At 10k edges with two anchors each, mount is about 250 ms faster and heap on mount about 70 MB lower.
