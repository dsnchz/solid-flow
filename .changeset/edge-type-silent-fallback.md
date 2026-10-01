---
"@dschz/solid-flow": patch
---

An edge with an unknown `type` still renders as the default edge but no longer reports error 011 through `onFlowError`, as in Svelte Flow (unknown node types still report 003). Dropping the per-edge check saves about 45 ms of mount and 2 MB at 10k edges.
