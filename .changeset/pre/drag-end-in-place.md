---
"@dschz/solid-flow": patch
---

Ending a node drag no longer replaces the node's drag-state entry with a fresh copy; it updates the two fields that changed in place, like every drag frame already did, so only what reads those fields re-runs.
