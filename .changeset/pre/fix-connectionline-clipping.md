---
"@dschz/solid-flow": patch
---

Fix the in-progress connection line clipping at a hard boundary and
rendering beneath nodes: a mangled CSS selector (`connectionline` instead of
`.solid-flow__connectionline`) meant the line's svg never received
`overflow: visible`, `z-index: 1001`, or `position: absolute`, so the path
scissored at the svg box (flow-origin) and its near-node segment hid behind
the node body.
