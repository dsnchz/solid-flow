---
"@dschz/solid-flow": major
---

Solid Flow 1.0, built for SolidJS 2.0.

The library is rebuilt on SolidJS 2.0's reactive model (draft-based store writes, deferred updates, the two-argument effect) with a redesigned read API, and on `@xyflow/system` 1.0, the engine shared with React Flow 13 and Svelte Flow 2. From 1.0 on, breaking changes take a major version. "Migrating from 0.2.x" in the README walks through the upgrade; the entries below list every change since 0.2.x.

Breaking changes:

- The peer dependencies are `solid-js` `^2.0.0` and `@solidjs/web` `^2.0.0` (0.2.x required `solid-js` `>=1.8.0`). SolidJS 1.x is not supported on this line; the 0.2.x line remains the SolidJS 1.x maintenance line.
- `jsxImportSource` for consumers compiling against the `solid` export condition is `@solidjs/web`.
- Store writes follow SolidJS 2.0: path-syntax setters (`setNodes(0, "position", "x", (x) => x + 20)`) are gone. Write through a draft callback (`setNodes((nodes) => { nodes[0]!.position.x += 20; })`), or return an array to replace the graph wholesale (rows keyed by id are reused).

Highlights:

- Controlled node and edge stores with a clear ownership contract (your store owns membership, the flow writes runtime fields onto the shared row objects), uncontrolled flows through `defaultNodes` / `defaultEdges`, and async, live and optimistic store sources.
- Two-tier viewport culling: an always-on CSS tier, plus opt-in `onlyRenderVisibleElements` unmount culling with a per-element `cullable: false` opt-out.
- Typed component schemas: `NodeProps` / `EdgeProps` with the `SolidFlowNode` / `SolidFlowEdge` guided unions, `satisfies`-friendly everywhere.
- React Flow and Svelte Flow parity gaps closed (MiniMap custom nodes and click handlers, reconnect anchors, element hooks, `useKeyPress`, server rendering), plus fixes for issues still open upstream in xyflow (stuck modifier keys after OS overlays, gestures surviving a window blur).
