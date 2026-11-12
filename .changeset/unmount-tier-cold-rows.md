---
"@dschz/solid-flow": patch
---

With `onlyRenderVisibleElements`, a node or edge that is never mounted no longer builds its internal row: it is built the first time something reads it (it comes on screen, is selected, or is read through `flow.internalNodes` / a hook), and stays built after that. Nodes inside a subflow are always built. Edge culling, in both tiers, now tests the box spanning the edge's two nodes against the viewport, as React Flow and Svelte Flow do, instead of the box between its two handles.
