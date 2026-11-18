---
"@dschz/solid-flow": patch
---

Runtime warnings route through `onFlowError` (one error channel, with a console fallback) instead of some going straight to `console.warn`. A node or edge with an unknown `type` renders the `default` component instead of nothing, as upstream does: an unknown node type reports error 003 through `onFlowError`, and an unknown edge type renders silently, as in Svelte Flow.
