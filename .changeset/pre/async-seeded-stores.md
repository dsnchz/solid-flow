---
"@dschz/solid-flow": minor
---

Async-seeded stores: `createNodeStore` / `createEdgeStore` now also accept `async () => data` (SolidJS 2.0 "Fetch High") — no memo required, the function goes straight to the store's projection derive. Reads are not-ready until the data lands, and `SolidFlow` surfaces that first-load pending state to your `<Loading fallback>` boundary — including for provider-adopted flows — instead of silently rendering an empty graph. After the seed resolves the stores are ordinary writable stores (drafts, connection adoption, wholesale replacement). New AsyncData playground example + "Loading your graph from an API" README section.
