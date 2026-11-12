---
"@dschz/solid-flow": patch
---

Deleting a parent node (`deleteElements` or the Delete key) removes all of its descendants, wherever they sit in the `nodes` array. Now that a child may come before its parent, a child or grandchild placed before its parent stayed behind with a dangling `parentId`. A node with `deletable: false` still keeps itself and its subtree, as in React Flow 13 and Svelte Flow 2.
