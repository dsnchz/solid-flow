---
"@dschz/solid-flow": patch
---

Three small gesture-path fixes: the measurement ingest's idle scheduling now carries a two-frame timeout so edges cannot lag a resizing node under continuous input; the pan/zoom controller no longer rebinds its handlers on every connection or box-selection move (it tracks equality-cut booleans instead of the per-move connection object and rect); and per-frame drag handler params are only built when an `onNodeDrag` handler is registered.
