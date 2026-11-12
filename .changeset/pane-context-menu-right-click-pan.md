---
"@dschz/solid-flow": patch
---

`onPaneContextMenu` fires when right-click panning is on (`panOnDrag` includes `2`), as in React Flow and Svelte Flow 2: a right click that does not pan reports the `mouseup` event, and a right-drag pan stays silent. It never fired with right-click panning on. Its `event` is now typed `MouseEvent` (was `PointerEvent`), which covers both the native `contextmenu` and that `mouseup`.
