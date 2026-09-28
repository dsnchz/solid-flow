---
"@dschz/solid-flow": patch
---

MiniMap renders its node component through `dynamic()` instead of the `<Dynamic>` component that solid-js rc.9 deprecates: one factory per MiniMap instance rather than a merge, an omit and a fresh factory per node. A runtime swap of `nodeComponent` still re-renders every node with the new component.
