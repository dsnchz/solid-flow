---
"@dschz/solid-flow": major
---

Solid Flow 1.0 — built for SolidJS 2.0.

The 0.3.0 prerelease line graduates to 1.0: the library is a ground-up rebuild on SolidJS 2.0's reactive foundation (draft-based store writes, deferred updates, the two-arg effect model) with a deliberately redesigned public API. From 1.0 on, breaking changes cost a major — the 0.x escape hatch is closed.

Highlights of the line (see the 0.3.0-next.* entries below for details):

- Controlled node/edge stores with a clear ownership contract: your store owns membership, the flow writes runtime fields onto shared row objects; any write form works (drafts are O(changed), wholesale replacement re-seeds with keyed row reuse).
- Two-tier viewport culling: an always-on CSS tier, plus opt-in `onlyRenderVisibleElements` unmount culling (at 10k nodes: ~16x less DOM, ~half the heap, ~3.7x faster drags) with `cullable: false` per-element opt-out.
- Typed component schemas: `NodeProps`/`EdgeProps` with `SolidFlowNode`/`SolidFlowEdge` guided unions, `satisfies`-friendly everywhere.
- Feature parity gaps closed (MiniMap custom nodes and click handlers, edge reconnection, SSR) plus fixes for issues still open upstream in xyflow (stuck modifier keys after OS overlays, drags surviving window blur, connection-line clipping).

Requires `solid-js` and `@solidjs/web` 2.x. The 0.2.x line remains the SolidJS 1.9+ maintenance line.
