---
"@dschz/solid-flow": patch
---

Bug sweep from the 2026-08-24 quality audit, every fix with a regression test:

- `nodesConnectable` prop was inert (a copy-paste wired it to `nodesDraggable`).
- The flow `id` (default `"1"`) leaked onto the root element as a DOM id, producing duplicate ids across flows; delete callbacks leaked as bogus DOM listeners. Flow props are now stripped via an exported `FLOW_PROP_KEYS` list whose completeness is a compile-time contract, so omit-list drift is a type error.
- A user `style` on a node could override the flow-computed width/height (defeating measured size), culling visibility, transform, and z-index. Ownership is now explicit: user style controls cosmetics; the flow owns size, stacking, positioning, visibility, and pointer-events.
- Programmatic `deleteElements()` never fired `onDelete` (only the Backspace path did). All delete paths now notify identically.
- `screenToFlowPosition` always snapped to a `[1, 1]` grid because its snap guard could never be false; fractional positions now survive when snapping is off.
- Edge selectability was resolved three different ways — box selection ignored `elementsSelectable` entirely, selecting edges a click could not. One `isEdgeSelectable` rule (edge flag, then `defaultEdgeOptions.selectable`, then `elementsSelectable`) now serves every path.
- `getIntersectingNodes` crashed on an unknown node id instead of returning `[]`.
- The measurement pass now receives the flow-level `nodeExtent`, aligning `expandParent` rect math with the projection's clamping rule.
- Removed the vestigial `reconnectRadius` threading and the dead unexported `EdgeAnchor` component (our reconnection API is Svelte-parity: you render your own anchor children).
