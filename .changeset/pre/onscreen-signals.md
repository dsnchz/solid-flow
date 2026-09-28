---
"@dschz/solid-flow": patch
---

Smoother pans on large graphs. Which nodes and edges are inside the culling viewport is now a per-row boolean signal instead of a keyed store record. The record cost the engine O(keys) to commit whenever its keys changed, a ~4 ms hitch at 10,000 nodes each time a pan crossed a culling step, and about 1 ms per frame while dragging a node at the pane edge with auto-pan running. A 60-move pane drag at 10,000 nodes went from about 22 to 15 ms of script (25 to 16 with culling on); nothing else moved outside run-to-run noise.
