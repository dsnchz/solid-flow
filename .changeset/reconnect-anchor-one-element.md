---
"@dschz/solid-flow": minor
---

`EdgeReconnectAnchor` follows Svelte Flow's:

- Breaking (custom CSS): it renders as one element, the edge label itself. The element carries `solid-flow__edge-label transparent solid-flow__edgeupdater solid-flow__edgeupdater-{type}` (plus `nopan` and your `class`), takes `size` as its width and height, and receives your `style` and extra attributes. In 0.2.x an edge label wrapped a second element that carried the updater classes, size and an inline `cursor`/`background`/`border`; selectors that reached the updater through the label (`.solid-flow__edge-label > .solid-flow__edgeupdater`) need updating. The updater's `cursor: move` now comes from the stylesheet.
- `onReconnectingChange` reports when the anchor's reconnect gesture starts and ends (the Solid translation of Svelte Flow's `bind:reconnecting`), and the `reconnecting` prop is honored as a controlled override.
- `dragThreshold` sets the pointer travel before a reconnect gesture starts, defaulting to the flow's `connectionDragThreshold`.

Reconnect fixes: `onBeforeReconnect` returning `undefined` now cancels the reconnect as documented (the edge was written anyway and `onReconnect` still fired). `onReconnectStart`, `onReconnect` and `onReconnectEnd` all receive the edge as it was when the gesture started, as in Svelte Flow (the later callbacks could receive the already reconnected edge).
