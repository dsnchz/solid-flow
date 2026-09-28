---
"@dschz/solid-flow": patch
---

Uncontrolled flows no longer retain their initial seed after the rows are deleted: the one-shot `defaultNodes` / `defaultEdges` adoption effects returned the copied seed array, and an effect keeps its last computed value for its lifetime, so every seeded row stayed reachable after a delete. The seed is now handed over in a box the effect empties.
