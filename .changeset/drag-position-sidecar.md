---
"@dschz/solid-flow": minor
---

Drag positions are now sidecar-backed (third slice of the solid#3085 composition): per-frame gesture positions live in a flow-owned overlay joined at read time, so dragging works — and dragged positions persist, including across `refresh()` reconciles — over `createOptimisticStore` inputs. The parity contract is unchanged for plain stores: your rows stay live during the drag, later position writes through your own store govern, and undo back to the exact pre-drag position works.
