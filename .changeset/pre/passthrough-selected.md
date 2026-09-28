---
"@dschz/solid-flow": patch
---

`updateNodeData`, and `updateNode` / `updateEdge` updaters that spread the row (`(node) => ({ ...node, data })`), no longer deselect a selected node or edge on an optimistic store whose rows carry `selected: false` (the shape `toObject()` persists). The spread passed the row's reverted `selected: false` back, and it was treated as a deselect. An object patch with `selected`, or an updater that changes it, still selects and deselects.
