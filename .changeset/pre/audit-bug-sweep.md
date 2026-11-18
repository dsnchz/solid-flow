---
"@dschz/solid-flow": patch
---

Fixes:

- The `nodesConnectable` prop was inert (it was wired to `nodesDraggable`).
- The flow `id` (default `"1"`) no longer leaks onto the root element as a DOM id, which produced duplicate ids across flows, and the delete callbacks no longer leak onto it as bogus DOM listeners.
- A user `style` on a node can no longer override the flow-computed width/height (defeating measured size), culling visibility, transform, and z-index. User style controls cosmetics; the flow owns size, stacking, positioning, visibility, and pointer-events.
- Programmatic `deleteElements()` fires `onDelete` (only the Backspace path did). All delete paths notify identically.
- `screenToFlowPosition` always snapped to a `[1, 1]` grid because its snap guard could never be false; fractional positions now survive when snapping is off.
- Edge selectability is resolved the same way everywhere: box selection ignored `elementsSelectable`, selecting edges a click could not. Every path now checks the edge's `selectable`, then `defaultEdgeOptions.selectable`, then `elementsSelectable`.
- `getIntersectingNodes` returns `[]` for an unknown node id instead of crashing.
- The measurement pass receives the flow-level `nodeExtent`, aligning `expandParent` rect math with the clamping rule positions follow.
