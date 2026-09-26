---
"@dschz/solid-flow": patch
---

Node row projections write only the leaves that changed on a measurement, selection or drag update instead of handing the engine a fresh row to reconcile (a user-row change still reconciles), and the measurement ingest writes its root leaf-wise with handle bounds as frozen records compared by identity, so an identical re-measure notifies nothing (10k mount 2.9 s -> 2.7 s, heap 819 -> 713 MB; an identical re-measure pass costs 90% less).
