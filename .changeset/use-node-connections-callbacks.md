---
"@dschz/solid-flow": patch
---

`useNodeConnections` accepts `onConnect` and `onDisconnect`, as in React Flow 13 and Svelte Flow 2: each is called with the connections that appeared or went away (an edge replaced by a new id between the same handles counts as both), not for the connections present on mount. They are read when a change lands, so the accessor can return a different callback later.
