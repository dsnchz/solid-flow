---
"@dschz/solid-flow": minor
---

Uncontrolled flows via `defaultNodes` / `defaultEdges` (React Flow parity). When you pass defaults instead of the controlled `nodes` / `edges` props, the flow owns element state: the arrays seed it once (later values are ignored, and the rows are copied, so the flow never writes onto your objects), and membership belongs to the flow: commands like `addNodes` / `deleteElements` and completed connections write through and persist, with no adoption step. The two axes are independent (nodes and edges can each be controlled or uncontrolled), the mode works under `SolidFlowProvider`, and supplying both props on one axis warns in dev with the controlled prop winning. See "Who owns the data" in the README.

`defaultNodes` / `defaultEdges` also accept rows from an async-seeded store ("seed the flow from server truth"): while the source is pending the flow seeds empty (cover it with `<Loading>` if desired) and adopts the rows when the data settles. This enables the draft-then-commit persistence pattern described in "Persisting your graph to a server" in the README: server truth in an async store outside the flow, edits accumulating in the flow-owned draft, and one action batch-submitting `toObject()`; a failed save keeps the draft, and a refresh cannot clobber edits.
