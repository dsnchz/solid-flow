---
"@dschz/solid-flow": patch
---

Fixed a memory leak in the node measurement pipeline: removing a node did
not unobserve its element from the shared `ResizeObserver`, so every
removed node's detached DOM element stayed pinned in the observer's target
list for the lifetime of the flow. Long-lived dynamic graphs (add/remove
node patterns) accumulated detached elements indefinitely; the wrapper now
unobserves its element on dispose.
