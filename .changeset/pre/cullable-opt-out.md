---
"@dschz/solid-flow": minor
---

Add `cullable: false` on nodes and edges to exempt an element from viewport culling on both tiers: the always-on CSS tier never hides it and `onlyRenderVisibleElements` never unmounts it. Use it for elements whose content must keep running off-screen (media playback, timers, third-party embeds). Fills the gap tracked upstream as xyflow/xyflow#5487.
