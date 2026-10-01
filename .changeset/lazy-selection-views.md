---
"@dschz/solid-flow": patch
---

The selected-nodes view (`flow.selection.nodes`) and the selection-box bounds are computed only while something reads them. Before, every selection write rebuilt them, and every drag frame of a selected node recomputed the bounds: at 10k nodes a zoomed-out box selection over 6,500 nodes takes about 12% less script, and a node drag with the minimap open about 27% less.
