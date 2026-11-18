---
"@dschz/solid-flow": patch
---

Large graphs stay interactive during gestures and bulk deletes (measured at 10k nodes):

- Connection drags: the closest-handle search reads a spatial grid of node geometry snapshotted at gesture start (geometry is frozen mid-gesture) instead of scanning every node on each pointer move, and handles follow equality-cut connection state instead of the per-move connection object, so snapping onto a handle touches two handles instead of all of them. A connection drag costs about 5 ms median per pointer move. The possible-target handle styling is derived from root-level classes in CSS, so a connection gesture no longer starts with a hitch.
- Box selection narrows its per-move sweep through the same grid and tracks membership in a `Set` instead of a per-node `ids.includes`; `getIntersectingNodes` shares one grid build across calls in the same task (it remains a snapshot API).
- `deleteElements` and the Delete key no longer scan the deleted list once per remaining node and edge, nor look up one by one the edges the deleted nodes already take with them: deleting 1,000 or 5,000 of 10k nodes takes about 0.2 s, and deleting every node and edge at once (select all, then Delete) under a second.
