---
"@dschz/solid-flow": patch
---

Breaking: the connection state that `onConnectEnd` and `onReconnectEnd` receive carries `to` in flow coordinates instead of screen coordinates (`@xyflow/system` 1.0, as in React Flow 13 and Svelte Flow 2). Code that converted it with `screenToFlowPosition` should use it as is.
