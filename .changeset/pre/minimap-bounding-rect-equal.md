---
"@dschz/solid-flow": patch
---

The MiniMap no longer recomputes its scale and viewBox on every pan or zoom inside the graph's bounds. Its bounding rect (the graph bounds joined with the visible viewport) came out as a fresh but equal object each time, so everything reading it re-ran; it now compares by value.
