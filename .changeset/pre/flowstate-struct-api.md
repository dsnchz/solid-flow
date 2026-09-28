---
"@dschz/solid-flow": minor
---

The data graph is now one public reactive struct. `useSolidFlow()` returns
`{ flow, commands }` — `flow` is the canonical read surface (`FlowState`:
graph roots, `internalNodes`/`layoutedEdges`/`connections` records,
`selection`, viewport, interaction and config state; every property read in a
tracked scope is a live subscription) and `commands` is the write surface
(`FlowCommands`), with every command also spread onto the returned object for
upstream familiarity. New public commands: `setNodes`, `setEdges`, `panBy`,
and `updateNodeInternals`. The imperative getters (`getNode`, `getNodes`,
`getEdge`, `getEdges`, `getViewport`, `getZoom`, `getInternalNode`,
`getHandleConnections`) are deprecated in favor of `flow` reads and will be
removed before 0.3.0 stable. The sugar hooks remain as one-line conveniences
over the struct. `FlowState`, `FlowSelection`, `FlowCommands`,
`ConnectionsRecord`, and `connectionKey` are exported from the package
entrypoint.
