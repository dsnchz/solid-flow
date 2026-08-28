---
"@dschz/solid-flow": patch
---

The sidecar release effect now confirms against row proxies captured at write time instead of resolving rows through the keyed lookup records — pulling a derived record inside the write flush triggered an O(sources) marking wave. Drag-start first frame at 10k nodes drops from ~250ms to ~45ms (~35x faster than two releases ago), and drag mean improves to ~4.7 ms/move.
