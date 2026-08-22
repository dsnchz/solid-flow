---
"@dschz/solid-flow": minor
---

`onlyRenderVisibleElements` now defaults to `true` and culls with CSS instead
of unmounting: off-screen nodes and edges stay mounted and get
`visibility: hidden` + `pointer-events: none`, so custom-node DOM state
survives off-screen, measurement/fitView/minimap are unaffected, and there is
no mount/unmount churn while panning. The visible set derives from an
overscanned, quantized viewport, so panning inside the margin does zero work
(measured: pan p95 unchanged vs culling off at 1600 and 10k nodes; recomputes
only on quantization-boundary crossings). Selected elements are never culled.
Pass `onlyRenderVisibleElements={false}` to keep every element visible — note
culled elements leave the accessibility tree and tab order while off-screen,
and keeping everything mounted still costs memory at large graph sizes.
