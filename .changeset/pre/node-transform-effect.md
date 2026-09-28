---
"@dschz/solid-flow": patch
---

A node's transform is written by its own render effect instead of through the style object, so a moved node writes one property per frame instead of rebuilding and diffing its whole style. Moving every node at 10,000 nodes went from about 355 to 335 ms (505 ms when the nodes are replaced with fresh objects, from about 550), and a 30-node selection drag from about 120 to 105 ms of script. Server-rendered markup still carries the transform. A user `transform` in a node's style never applied and still does not.
