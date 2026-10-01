---
"@dschz/solid-flow": patch
---

Edge reconnect: `onBeforeReconnect` returning `undefined` now cancels the reconnect as documented (the edge was written anyway and `onReconnect` still fired). `onReconnectStart`, `onReconnect` and `onReconnectEnd` all receive the edge as it was when the gesture started, as in Svelte Flow (after a flush between the connect and the gesture end, `onReconnectEnd` received the reconnected edge). The reconnect writes the one edge by id instead of mapping every edge.
