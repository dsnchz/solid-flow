---
"@dschz/solid-flow": patch
---

The unique edge marker definitions are now collected from the edge rows, which already read each edge's `markerStart` / `markerEnd`, instead of a separate reactive memo per edge. The rendered markers are unchanged.
