---
"@dschz/solid-flow": patch
---

Parent nodes no longer need to come before their children in the `nodes` array, as in React Flow 13 and Svelte Flow 2 (`@xyflow/system` 1.0). A child is positioned inside its parent wherever either sits in the array, including chains whose ancestors all come later, and a child is linked as soon as its parent is added. A node whose parent is missing, or whose `parentId`s form a cycle, keeps its own position and reports `parent-missing` through `onError` with the upstream message `Parent node with id "<parentId>" is missing for child node with id "<id>"` (previously: "Parent node <parentId> not found. Please make sure that parent nodes are in front of their child nodes in the nodes array."). With `zIndexMode="auto"`, root parents get their z blocks in the order their first child resolves, as upstream does.
