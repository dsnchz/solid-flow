---
"@dschz/solid-flow": patch
---

The culling viewport hugs the visible area more closely: its overscan margin is 0.25 of the viewport instead of 0.5, and its zoom buckets are quarter octaves instead of powers of two. With `onlyRenderVisibleElements`, a zoomed-out pan used to mount and unmount a large stripe of elements at each quantization step (100-260 ms frames at 10k nodes); the mounted set is now about half as large and each step's stripe is smaller.
