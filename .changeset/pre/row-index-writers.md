---
"@dschz/solid-flow": patch
---

Per-frame writers resolve their target rows by index instead of walking the whole draft. Drag position writes, selection flips (click, box selection, deselect), arrow-key moves and measurement write-back used to iterate every row of the nodes/edges draft to find their handful of targets — at 10k nodes that was ~20k proxy trap reads per drag frame and per box-selection move. A membership-cadence id → index map (`createRowIndex`) now resolves each target in O(1), and the selection writers derive their candidates from the keyed presence record (the delta between current and target selection).
