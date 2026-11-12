---
"@dschz/solid-flow": patch
---

Each node row now carries its part of its edges' z-index, so an edge redraws its z from two reads per endpoint instead of six, and no flow setting. At 10k nodes a deselect-all takes about 6% less time and the mount about 3% less; replacing every node object at once (`setNodes` with fresh objects) takes about 4% more. The drawn z-index is unchanged, including for child nodes, manual `zIndexMode` and an `elevateEdgesOnSelect` that changes at runtime.
