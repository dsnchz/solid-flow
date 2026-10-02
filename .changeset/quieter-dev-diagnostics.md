---
"@dschz/solid-flow": patch
---

Fewer dev-mode reactivity warnings. The dev runtime no longer reports `WIDE_SCOPE_DEPS` on every edge row and every node element of a flow, nor on the node and edge id lists once a flow passes about 15 nodes. Each edge now follows its two endpoints through one version per node instead of a dozen geometry fields each, and a node's class is written by its own effect. The id lists follow the arrays' structure instead of every row. Memory and timings at 10k nodes are unchanged or slightly better. Very large flows can still report `WIDE_SCOPE_DEPS` on the whole-graph merges, which read every row by design.
