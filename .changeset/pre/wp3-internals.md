---
"@dschz/solid-flow": patch
---

Internal restructuring (WP3): the controlled/uncontrolled seeding policy, the measurement ingest lifecycle, and the selection command group now live in their own headless-testable core modules; dead internals removed (unused signal setters, unread store getters, a triply-plumbed pane click-distance path, vestigial actions). Behavioral fix riding along: `addSelectedEdges` now uses Set membership like `addSelectedNodes` (was O(edges x selection) per box selection).
