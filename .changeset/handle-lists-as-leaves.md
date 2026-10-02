---
"@dschz/solid-flow": patch
---

A node's measured source and target handles are now updated separately, so a measuring pass that moves only one side's handles no longer re-runs whatever reads the other side. The dev runtime no longer reports `IMMUTABLE_UPDATE_IN_STORE` on `handleBounds` when handles move (for example after a node's handle positions change).
