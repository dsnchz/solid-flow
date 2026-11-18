---
"@dschz/solid-flow": minor
---

Viewport culling in two tiers:

- Breaking: `onlyRenderVisibleElements` now does what its name says (0.2.x accepted the prop but it was inert). With it, off-viewport nodes and edges are unmounted entirely and remount as the viewport reaches them, matching React Flow's and Svelte Flow's semantics for the prop; it still defaults to `false`. At 10k nodes this cuts the DOM ~16x, roughly halves memory, and makes node drags several times faster. The data graph is unaffected: positions, selection, and cached measurements live outside the components, so remounted elements come back exactly as they left. Component-local state (signals inside custom nodes, uncontrolled inputs) does not survive unmounting: keep state in `node.data`. Never unmounted: selected elements, unmeasured nodes, and the element holding DOM focus. A node whose size (`measured`) and `handles` are declared is not mounted while it is off screen (its edges anchor on the declared handles until it mounts), and an edge is culled by the box spanning its two nodes, as in React Flow and Svelte Flow.
- A CSS culling tier is always on and needs no prop: elements outside an overscanned viewport are hidden with `visibility: hidden` + `pointer-events: none` and stay mounted, so component state and measurement are untouched. Selected elements are never hidden.
- `cullable: false` on a node or edge exempts it from both tiers: the CSS tier never hides it and `onlyRenderVisibleElements` never unmounts it. Use it for elements whose content must keep running off screen (media playback, timers, third-party embeds). Fills the gap tracked upstream as xyflow/xyflow#5487.
