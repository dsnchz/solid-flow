---
"@dschz/solid-flow": minor
---

Event-callback parity with React Flow: `onNodeDoubleClick`, `onEdgeDoubleClick`, `onEdgePointerMove`, `onPaneScroll`, `onPanePointerEnter` / `onPanePointerMove` / `onPanePointerLeave`, and `onViewportChange` (fires on every viewport change, programmatic ones included). The event surface now covers everything Svelte Flow exposes plus the React Flow set, except `onNodesChange`/`onEdgesChange`, which don't exist by design in a store-based flow.
