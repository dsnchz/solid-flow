---
"@dschz/solid-flow": patch
---

`EdgeLabel` moves its element into the flow's edge-label layer the way Svelte Flow does (1.x and 2.0), instead of rendering through a portal. Clicking a label no longer selects its edge unless `selectEdgeOnClick` is set (before, the click bubbled through the portal to the edge). Each label is lighter: at 10k labelled edges about 26 MB less heap and 3-4% faster mount. `EdgeLabelRenderer` keeps its portal (React Flow's contract).
