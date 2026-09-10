---
"@dschz/solid-flow": patch
---

Multi-selection wrapper bounds derive from the keyed selected-presence record (O(selected) reads and subscriptions) instead of a tracked scan of every node. The previous memo subscribed every node's `selected` leaf and rebuilt those subscriptions on every frame of a selection-mode drag; at 10k nodes that was a ~20k-dependency memo on the per-frame path.
