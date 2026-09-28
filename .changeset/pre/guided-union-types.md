---
"@dschz/solid-flow": minor
---

The guided node/edge unions behind `createNodeStore`/`createEdgeStore` are
now exported as `NodesFor<typeof nodeTypes>` / `EdgesFor<typeof edgeTypes>`,
so the same per-type data narrowing works on plain arrays, props, and
vanilla stores (`satisfies NodesFor<...>[]`). The unions are also more
robust: the `type` discriminant is now the renderer-map KEY (what actually
gets matched), components with odd-but-legal signatures degrade to open
data instead of collapsing their key to `never`, and omitting the generic
still rejects custom type names loudly (`NoInfer` guards the argument).
