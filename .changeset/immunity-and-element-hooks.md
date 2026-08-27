---
"@dschz/solid-flow": minor
---

New element hooks matching upstream's latest additions (xyflow#5868): `useNode`, `useEdge`, `useSelectedNodes`, `useSelectedEdges` — all reactive, all Accessor-input. Plus a pinned immunity suite for upstream bugs Solid Flow dodges structurally: connections and MiniMap panning survive full flow remounts (xyflow#5971/#5933), `setNodes` inside `onNodeDrag` doesn't freeze the dragged node (xyflow#4760), edges never leave the DOM when nodes are added (xyflow#5970), non-adjacent edges aren't re-laid-out by node moves (the failure mode behind xyflow#5958), and the pan-activation key enables primary-button panning with `panOnDrag` off (xyflow#5923). New Remount playground example.
