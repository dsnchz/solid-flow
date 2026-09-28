---
"@dschz/solid-flow": patch
---

The theme colors are now CSS `light-dark()` values chosen by the flow container's `color-scheme`, instead of a separate `.solid-flow.dark` override block per stylesheet. Colors are unchanged. The container now declares `color-scheme`, so browser-drawn controls inside the flow (inputs, scrollbars in custom nodes) follow the flow's theme. Overriding a theme variable (`--xy-node-background-color` and friends) works as before.
