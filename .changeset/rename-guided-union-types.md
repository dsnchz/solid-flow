---
"@dschz/solid-flow": minor
---

Rename the guided union types: `NodesFor` → `SolidFlowNode` and `EdgesFor` → `SolidFlowEdge` (breaking for prerelease users of the old names; no aliases kept — the stable 1.0 ships only the new names). The old names only read well with an explicit argument (`NodesFor<typeof nodeTypes>`); the new ones read correctly bare too (`satisfies SolidFlowNode[]`). Semantics are unchanged: element-level unions narrowed by your renderer map, `satisfies`-friendly anywhere.
