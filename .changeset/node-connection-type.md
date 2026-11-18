---
"@dschz/solid-flow": patch
---

Connection APIs follow `@xyflow/system` 1.0, as in React Flow 13 and Svelte Flow 2:

- Breaking (types): the `HandleConnection` type export is removed; use `NodeConnection`, which has the same shape. The connection index, `useNodeConnections` and the `Handle` `onConnect` / `onDisconnect` callbacks report `NodeConnection`s.
- New command `getNodeConnections({ nodeId, type?, handleId? })`, as on React Flow 13's `useReactFlow` and Svelte Flow 2's `useSvelteFlow`, replacing the removed `getHandleConnections`: the `NodeConnection`s of a node, filtered by handle type and, with a type, by handle id. Read in a tracked scope it subscribes like `flow.connections`.
- `useNodeConnections` accepts `onConnect` and `onDisconnect`: each is called with the connections that appeared or went away (an edge replaced by a new id between the same handles counts as both), not for the connections present on mount. They are read when a change lands, so the accessor can return a different callback later.

Fixed: the `Handle` `onConnect` / `onDisconnect` callbacks and `useNodeConnections` no longer miss changes on a handle with several connections or on a partial removal. The connection lookup is kept as immutable per-key snapshots; it used to be one map mutated in place, so a change compared equal to the previous state.
