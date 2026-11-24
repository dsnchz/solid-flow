---
"@dschz/solid-flow": patch
---

`useNodeConnections` no longer calls `onConnect` / `onDisconnect` when the node or handle it observes changes (`id`, `handleType` or `handleId`): switching from one node to another changes no edge, so it is a new starting point, like the mount. Before, every connection of the old node was reported as disconnected and every connection of the new one as connected (xyflow#6163).
