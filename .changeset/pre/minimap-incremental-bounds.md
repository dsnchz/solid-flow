---
"@dschz/solid-flow": patch
---

MiniMap graph bounds are sampled incrementally. A full bounds pass reads ~7 proxy leaves per node (~29ms at 10k nodes in the browser) and previously ran every 500ms for as long as a minimap was mounted. The minimap now partitions the graph once per drag (dragged rows and their descendants move, everything else is a frozen box) and unions only the moving rows per animation frame; idle re-samples are driven by a cheap geometry-version poll, so a still graph is never rescanned. Node drags now also set the flow-level `dragging` flag (upstream parity) — previously only pane drags did, so the minimap's per-frame sampling never ran during node drags and lagged behind by up to 500ms.
