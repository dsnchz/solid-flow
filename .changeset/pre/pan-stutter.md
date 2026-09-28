---
"@dschz/solid-flow": patch
---

Smooth pane drags on large graphs. Two causes of periodic frame drops during a pan at 10k nodes are gone: (1) every node and edge wrapper subscribed to the quantized culling viewport, so each quarter-viewport step re-ran ~20k culling memos through the store proxies (50–66 ms frames); on-screen membership is now computed once per step from the flow's plain geometry maps into keyed records, and rows subscribe per key, so a step touches only the rows that entered or left. (2) The pane changed its `cursor` at drag start and end; `cursor` is inherited, so the browser re-styled every descendant (~70 ms). The pan cursor is now a leaf cover element shown while a pan is held, and node drags show the node's own cursor. Frame gaps during a 2.5 s pane drag at 10k: five at 50–66 ms → none above 25 ms.
