---
"@dschz/solid-flow": patch
---

New command `changeParent(nodeId, parentId)`, as in React Flow 13 and Svelte Flow 2: moves a node under another parent (`null` for none) without moving it on screen, recomputing its `position` relative to the new parent (origin included), for example to drop a node into a group.
