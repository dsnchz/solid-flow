---
"@dschz/solid-flow": patch
---

Arrowhead markers without an explicit color (`color: null`, or `defaultMarkerColor={null}`) take the edge stroke again. They wrote `var(--xy-edge-stroke)` into an SVG attribute, which only resolved when the app itself set that variable; otherwise a closed arrowhead rendered as a black triangle and an open `arrow` marker was invisible. A stylesheet rule now colors them from `--xy-edge-stroke`, falling back to the theme's edge color, as in React Flow and Svelte Flow. Explicit marker colors are applied as inline style and still win.
