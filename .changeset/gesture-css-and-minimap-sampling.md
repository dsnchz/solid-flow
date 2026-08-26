---
"@dschz/solid-flow": patch
---

Two more large-graph wins (benchmarked at 10k nodes): connection gestures now average 2.4ms per move with no start-of-gesture hitch (was a ~490ms spike — the possible-target handle affordance is derived from root-level classes in CSS instead of a per-handle computation), and dragging with the MiniMap open costs the same as without it (76 → 17ms/move — graph bounds are sampled per animation frame during drags instead of tracked through the reactive lookup). Breaking for custom CSS only: handles no longer emit the `connectionindicator` class; target `.solid-flow.connecting .solid-flow__handle.connectable.connectableend` (see handle styles) instead.
