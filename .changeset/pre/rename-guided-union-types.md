---
"@dschz/solid-flow": minor
---

The guided node and edge unions behind `createNodeStore` / `createEdgeStore` are exported as `SolidFlowNode<typeof nodeTypes>` / `SolidFlowEdge<typeof edgeTypes>`, so the same per-type data narrowing works on plain arrays, props, and vanilla stores (`satisfies SolidFlowNode<typeof nodeTypes>[]`, or bare `satisfies SolidFlowNode[]` for the built-in types). The unions are also more robust: the `type` discriminant is the renderer-map key (what actually gets matched), components with odd-but-legal signatures degrade to open data instead of collapsing their key to `never`, and omitting the generic still rejects custom type names loudly (`NoInfer` guards the argument).
