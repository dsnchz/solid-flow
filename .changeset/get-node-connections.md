---
"@dschz/solid-flow": patch
---

New command `getNodeConnections({ nodeId, type?, handleId? })`, as on React Flow 13's `useReactFlow` and Svelte Flow 2's `useSvelteFlow`: the `NodeConnection`s of a node, filtered by handle type and, with a type, by handle id. Read in a tracked scope it subscribes like `flow.connections`.
