---
"@dschz/solid-flow": patch
---

Faster mount at scale (10k nodes: 3.6 s -> 3.1 s, heap 870 -> 832 MB). Row elements now mount in the settle flush instead of inside the initial render (the store is still seeded synchronously, so children read the graph during their own setup); the culling viewport and pan-zoom exist before the first row does. Per-row diet: one `Show` per row (the renderers decide `hidden`), the `domAttributes` spread is installed only for rows that have them, the unknown-type report rides the measure effect, and a `Handle` creates its connection effect only when `onConnect`/`onDisconnect` is passed. Server rendering and hydration keep rendering rows immediately.
