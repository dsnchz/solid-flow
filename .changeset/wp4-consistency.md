---
"@dschz/solid-flow": patch
---

Consistency sweep (audit WP4): all runtime warnings route through `onFlowError` (one error channel, console fallback); unknown node/edge types now render the `default` component instead of nothing, reporting error003/error011 (upstream parity); the internal layouted-edge accessor is named `getLayoutedEdge` to stop shape confusion with the raw `edgeLookup`; `useNodes`/`useEdges` read the public flow surface; duplicated internals unified (the XYHandle gesture params shared by Handle and EdgeReconnectAnchor — fixing a silent validation-handling divergence — the keyed-record projection tail, and the renderers' focus tracker); ConnectionLine and MiniMap drop all non-null assertions in favor of narrowed types; MiniMap attribute callbacks (`nodeColor` etc.) now receive the user node, matching upstream.
