---
"@dschz/solid-flow": patch
---

With `onlyRenderVisibleElements`, the node and edge renderers iterate only the rows they mount (on screen, selected, `cullable: false`, unmeasured or focused) instead of keeping a reactive gate for every row, so an off-screen row costs the renderers nothing. Which rows mount is unchanged.
