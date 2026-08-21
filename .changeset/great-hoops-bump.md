---
"@dschz/solid-flow": patch
---

Update `@xyflow/system` from 0.0.68 to 0.0.80, pulling in 12 patch releases of upstream fixes (pan/zoom filter improvements, `fitView` fixes for hidden and unmeasured nodes, `getNodesBounds` no longer stretching to the origin for unresolvable nodes, `extent: 'parent'` resolution, dark-mode background pattern color, and more).

Port the matching integration changes from Svelte Flow 1.6.3:

- Thread `panActivationKeyPressed` into the pan/zoom filter so a Control-key pan activation allows primary-button dragging.
- Prefer touch panning over drag selection when `selectionOnDrag` is combined with mouse-button-specific `panOnDrag` settings.
- Thread `panOnScrollSpeed`, `selectionOnDrag`, `paneClickDistance`, and `connectionInProgress` through to the pan/zoom instance.

Fix a race where the initial `fitView` could run before the flow container was measured, producing a zero/invalid viewport (blank canvas). The initial fit now waits for both measured nodes and container dimensions, whichever arrives last.
