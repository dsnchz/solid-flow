---
"@dschz/solid-flow": patch
---

Gesture starts no longer walk every node. The internal-node derive now reports each row's absolute rect to a plain geometry map the moment it changes, and the three gesture-start scans read that map instead of the reactive rows: the connection gesture's spatial-grid arm, box selection's arm, and the minimap's dragged/static partition. At 10k nodes the minimap's first sample during a drag drops from ~40 ms to ~1 ms; the connection arm from ~25 ms to ~2 ms.
