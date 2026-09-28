---
"@dschz/solid-flow": patch
---

Slightly cheaper drags. The library no longer registers a delegated `pointermove`, so a pointer move during a drag skips the runtime's event-delegation walk: the pane listens directly, and nodes and edges attach a listener only when `onNodePointerMove` / `onEdgePointerMove` is passed. The node drag controller also reads only the settings each drag step needs instead of rebuilding a 15-field object about five times per move. At 10,000 nodes a 60-move node drag went from about 31 to 29 ms of script, and a node drag with the minimap from about 48 to 45; nothing else moved.
