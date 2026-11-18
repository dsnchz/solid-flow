---
"@dschz/solid-flow": patch
---

An internal node's `internals.isParent` tells whether the node currently has children (`@xyflow/system` 1.0's `InternalNode`): it turns `true` when a child names it as `parentId` and back to `false` when its last child goes away.
