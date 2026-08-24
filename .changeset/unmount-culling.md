---
"@dschz/solid-flow": minor
---

**Breaking (prerelease line):** `onlyRenderVisibleElements` is repurposed to
mean what its name says — true conditional rendering — and its default flips
to `false`. Off-viewport nodes and edges are unmounted entirely and remount
as the viewport reaches them, matching React/Svelte Flow's semantics for the
prop. At 10k nodes this cuts the DOM ~16x, roughly halves memory, and makes
node drags ~3.7x faster (unmounting removes most live observers from the
reactive graph). The data graph is unaffected: positions, selection, and
cached measurements live outside the components, so remounted elements come
back exactly as they left. Component-local state (signals inside custom
nodes, uncontrolled inputs) does not survive unmounting — keep state in
`node.data`. Never unmounted: selected elements, unmeasured nodes, and the
element holding DOM focus.

The previous CSS culling behavior (hide off-viewport elements with
`visibility: hidden` + `pointer-events: none`, everything stays mounted) is
now always on and no longer tied to this prop — it is semantics-preserving
and needs no switch. `CullingSource` accordingly lost its
`onlyRenderVisibleElements` field.

Also fixed: `NodeWrapper` now unobserves its element from the shared
measurement `ResizeObserver` on dispose (previously removed nodes stayed
pinned in the observer's target list).
