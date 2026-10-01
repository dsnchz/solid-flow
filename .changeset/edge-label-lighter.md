---
"@dschz/solid-flow": patch
---

Edge labels are lighter: `EdgeLabel` no longer routes its element through a props spread, and `EdgeLabelRenderer` finds the label layer once per flow instead of once per label. At 10k labelled edges this saves about 14 MB of heap and 2-3% of mount time.
