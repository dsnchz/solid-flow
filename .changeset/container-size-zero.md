---
"@dschz/solid-flow": patch
---

The flow's `width` and `height` are `0` until the container is measured, as in React Flow and Svelte Flow. They were `undefined` without the `width`/`height` props, so a `MiniMap` drew its first frame with a `NaN` viewBox and mask path (Chrome logged `<path> attribute d: Expected number`).
