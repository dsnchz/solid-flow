---
"@dschz/solid-flow": patch
---

A selection box now updates only the nodes and edges that enter or leave it on each move, instead of re-deriving and rewriting the whole selection: at 10k nodes, a zoomed-out box growing to 6,500 selected nodes takes about 24% less script.
