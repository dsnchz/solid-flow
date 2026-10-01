---
"@dschz/solid-flow": patch
---

`onSelectionChange` is subscribed only while a handler is set, as in React Flow: without one, selection writes no longer build the selected arrays to compare them. A handler set after mount is now called with the current selection (it was not called until the selection next changed).
