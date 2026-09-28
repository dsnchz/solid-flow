---
"@dschz/solid-flow": patch
---

Completed connections are no longer written into a controlled edges store. The completion write pierced into the user's store (the internal store wraps their proxy), so the documented `onConnect` adoption push produced a duplicate row with the same id — invisible in the DOM (the derived edge record is keyed by id) but persisted by `toObject()`. Connection completion is now a no-op on a controlled axis: the connection reaches you only through `onConnect`, and adopting it is what makes it exist (unadopted connections are dropped). Uncontrolled flows (`defaultEdges`) are unchanged — the flow owns membership and inserts the edge itself. Playground examples that relied on the auto-insert now adopt, and the README/llms.txt ownership contract is updated to match.
