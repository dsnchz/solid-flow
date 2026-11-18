---
"@dschz/solid-flow": patch
---

Breaking: `paneClickDistance` is replaced by `paneDragThreshold` (default `1`), as in React Flow 13 and Svelte Flow 2. The pane starts panning or a selection box only once the pointer has moved further than the threshold; a shorter movement is a click (`onPaneClick`, or `onPaneContextMenu` when panning with the right mouse button), with every mouse button `panOnDrag` enables. Rename the prop; the old default `0` made any movement a drag.
