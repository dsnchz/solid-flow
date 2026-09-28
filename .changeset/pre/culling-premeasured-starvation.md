---
"@dschz/solid-flow": patch
---

Fix `onlyRenderVisibleElements` starving pre-measured nodes of their first mount. A node arriving with `measured` already set (persisted layout, SSR payload, or a remounted flow reusing the same node objects) was unmount-culled before ever mounting, so its handle bounds never populated in that flow instance and every edge touching it silently failed to lay out. Off-viewport nodes now always mount once until their handle bounds exist.
