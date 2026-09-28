---
"@dschz/solid-flow": minor
---

BREAKING: the deprecated imperative getters on `useSolidFlow()` are removed
(`getNode`, `getNodes`, `getEdge`, `getEdges`, `getViewport`, `getZoom`,
`getInternalNode`, `getHandleConnections`) — read the same state from `flow`
instead (`flow.nodes`, `flow.internalNodes[id]`, `flow.viewport`,
`flow.connections`); in Solid, reads inside event handlers are already
untracked, so no getter wrapper is needed. `useNodes()` and `useEdges()` now
return `readonly` arrays — mutate through commands, not array methods.
