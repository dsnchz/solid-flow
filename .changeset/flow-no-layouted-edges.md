---
"@dschz/solid-flow": patch
---

`useSolidFlow().flow` no longer exposes `layoutedEdges`. The per-edge geometry the renderers draw is internal, as in React Flow and Svelte Flow; a custom edge receives its geometry as props (`sourceX`, `targetY`, …), and `flow.edges` / `useEdges` give the edges themselves.
