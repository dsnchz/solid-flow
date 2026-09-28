---
"@dschz/solid-flow": minor
---

Uncontrolled flows via `defaultNodes` / `defaultEdges` (React Flow parity). When you pass defaults instead of the controlled `nodes` / `edges` props, the flow owns element state: the arrays seed it once (later values are ignored), and membership belongs to the flow — commands like `addNodes` / `deleteElements` and completed connections write through and persist, with no adoption step. The two axes are independent (nodes and edges can each be controlled or uncontrolled), the mode works under `SolidFlowProvider`, and supplying both props on one axis warns in dev with the controlled prop winning. See "Who owns the data" in the README and the new Uncontrolled playground example.
