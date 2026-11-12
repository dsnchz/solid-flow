---
"@dschz/solid-flow": patch
---

The flow's selected-node, selected-edge and unmeasured-node sets are now kept by the node and edge rows that already compute selection and measurement, instead of a separate reactive projection per row for each set: three fewer reactive scopes per node and edge pair. Selection and `nodesInitialized` behave as before.
