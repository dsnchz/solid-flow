---
"@dschz/solid-flow": patch
---

Large-graph mount is ~2x faster. Node and edge wrappers created effects over their element ref signal (dblclick wiring, measurement requests, the ResizeObserver, drag setup); because the ref is written while the row mounts, those effects sat dirty in the reactive engine's pending heap for the whole synchronous mount, and every later row's first memo read re-marked that heap — an O(N²) cost that was about half of a 10k-node production mount. The wrappers now wire their element from the ref callback under the component owner, so no effect depends on the ref signal. 10k nodes mount in ~4.3s instead of ~9.7s; gestures and writes are unchanged. The `dragging` class and node-component prop now come from the flow-owned `dragging` field rather than the drag helper's local signal.
