---
"@dschz/solid-flow": minor
---

`defaultNodes` / `defaultEdges` now accept rows from an async-seeded store — "seed the flow from server truth". While the source is pending the flow seeds empty (cover it with `<Loading>` if desired) and adopts the rows when the data settles; previously this was a hard `PENDING_ASYNC_UNTRACKED_READ` error. This enables the documented draft-then-commit persistence pattern (new README section + Persistence playground example): server truth in an async store outside the flow, edits accumulating in the flow-owned draft, one action batch-submitting `toObject()` — a failed save keeps the draft, and the refresh reconcile can't clobber edits. Passing a `createOptimisticStore` as `nodes`/`edges` is documented as unsupported (flow-internal writes would revert with the overlay).
