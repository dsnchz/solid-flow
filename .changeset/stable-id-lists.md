---
"@dschz/solid-flow": patch
---

A write that replaces node or edge objects but keeps their ids (the measured sizes written back into a controlled `nodes` array, an `updateNode` with `replace: true`) no longer re-runs the renderers' lists and everything keyed on them. The dev runtime reported it as `UNSTABLE_MEMO_OUTPUT` on `visibleNodeIds`.
