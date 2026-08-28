---
"@dschz/solid-flow": minor
---

Full `createOptimisticStore` support — the final slice. Membership is now rendered from the user-facing store (a derived record's enumeration doesn't surface optimistic membership edits mid-action; direct row reads do), so an optimistic node/edge add appears immediately mid-action, a rejected action reverts the flow cleanly, and flow commands work inside open action transactions. `updateNode`/`updateEdge` route `selected` through the selection sidecar, so programmatic selection composes over optimistic stores like gesture selection. Together with the selection, drag-position, and measurement sidecars, the optimistic-compat acceptance suite is fully green: Solid Flow now composes with the part-2 "Write Sync, Run Async" pattern end to end.
