---
"@dschz/solid-flow": minor
---

Live flows: `createNodeStore` / `createEdgeStore` now accept an async **generator** source — "a value that keeps arriving". The store is unsettled until the first yield, then every yield streams into the graph with fine-grained updates: membership changes, node moves, and removals all flow through. Paired with a `live()` server function this is a server-pushed, collaborative flow in a handful of lines — see the new LiveFlow playground example and the "Live flows" README section.
