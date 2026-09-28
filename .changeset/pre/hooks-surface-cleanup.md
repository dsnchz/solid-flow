---
"@dschz/solid-flow": minor
---

Hooks surface cleanup for React/Svelte Flow parity: `useNodeId` and
`useEdgeId` are now public (learn which node/edge a nested component is
rendered inside — composable custom nodes and edge labels without prop
drilling). BREAKING: `useHandleEdgeSelect` is removed (internal plumbing
that was never consumed; select edges through `commands` instead).
