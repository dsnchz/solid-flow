---
"@dschz/solid-flow": patch
---

Parent nodes no longer need to come before their children in the `nodes` array, as in React Flow 13 and Svelte Flow 2 (`@xyflow/system` 1.0). A child is positioned inside its parent wherever either sits in the array, including chains whose ancestors all come later, and a child is linked as soon as its parent is added. A node whose parent is missing, or whose `parentId`s form a cycle, keeps its own position and reports `parent-missing` through `onError` with the upstream message `Parent node with id "<parentId>" is missing for child node with id "<id>"` (previously: "Parent node <parentId> not found. Please make sure that parent nodes are in front of their child nodes in the nodes array."). With `zIndexMode="auto"`, root parents get their z blocks in the order their first child resolves, as upstream does. Deleting a parent node (`deleteElements` or the Delete key) removes all of its descendants, wherever they sit in the array; a node with `deletable: false` keeps itself and its subtree.

New command `changeParent(nodeId, parentId)`, as in React Flow 13 and Svelte Flow 2: moves a node under another parent (`null` for none) without moving it on screen, recomputing its `position` relative to the new parent (origin included), for example to drop a node into a group.

An internal node's `internals.isParent` tells whether the node currently has children (`@xyflow/system` 1.0's `InternalNode`): it turns `true` when a child names it as `parentId` and back to `false` when its last child goes away.
