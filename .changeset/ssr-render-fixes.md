---
"@dschz/solid-flow": patch
---

Fix server-side rendering: `<SolidFlow>` can now be rendered with `renderToString` (e.g. in SolidStart) without crashing. The node `ResizeObserver` was constructed during render (it is now browser-only), and the selection auto-pan cleanup called `cancelAnimationFrame` on disposal even on the server. Nodes that declare `width`/`height` render server-side with correct positions and visibility, and `fitView` with explicit flow `width`/`height` props is computed on the server — matching React Flow 12's SSR contract.
