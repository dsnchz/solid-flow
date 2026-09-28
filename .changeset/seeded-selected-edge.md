---
"@dschz/solid-flow": patch
---

A flow whose initial edges include one with `selected: true` no longer crashes on creation (`Cannot access 'edgeLookup' before initialization`). The selection starts with the nodes and edges the rows declare as selected.
