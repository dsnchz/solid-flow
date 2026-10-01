---
"@dschz/solid-flow": patch
---

Selecting or deselecting nodes no longer recomputes their edges' geometry: with `elevateEdgesOnSelect` (the default) the endpoint part of an edge's z-index is added where the edge is drawn. At 10k nodes a select-all takes about 20% less time, a deselect-all about 22% less. The drawn z-index is unchanged.
