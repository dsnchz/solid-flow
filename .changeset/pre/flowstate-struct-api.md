---
"@dschz/solid-flow": minor
---

`useSolidFlow()` returns `{ flow, commands }`. `flow` (`FlowState`) is the canonical read surface: the graph roots, the `internalNodes` and `connections` records, `selection`, viewport, interaction and config state; every property read in a tracked scope is a live subscription. `commands` (`FlowCommands`) is the write surface, and every command is also spread onto the returned object for upstream familiarity, so `const { fitView } = useSolidFlow()` keeps working. New commands: `setNodes`, `setEdges`, `panBy` and `updateNodeInternals`. `FlowState`, `FlowSelection`, `FlowCommands`, `ConnectionsRecord` and `connectionKey` are exported from the package entrypoint.

Breaking: the imperative getters are removed (`getNode`, `getNodes`, `getEdge`, `getEdges`, `getViewport`, `getZoom`, `getInternalNode`, `getHandleConnections`). Read the same state from `flow` instead (`flow.nodes`, `flow.internalNodes[id]`, `flow.viewport`, `flow.connections`), or use the new `getNodeConnections` command; in Solid, reads inside event handlers are already untracked, so no getter wrapper is needed. The per-edge geometry the renderers draw is internal, as in React Flow and Svelte Flow: a custom edge receives its geometry as props (`sourceX`, `targetY`, …). `useNodes()` and `useEdges()` return `readonly` arrays: mutate through commands, not array methods.
