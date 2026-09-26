---
"@dschz/solid-flow": patch
---

BaseEdge installs an attribute spread only when extra attributes are passed (the built-in edge types pass none), takes its default without a per-edge getter object, and the edge wrapper attaches pointerenter, pointerleave and dblclick listeners only when the flow passes the matching callback, like nodes (10k mount 2.7 s -> 2.6 s, heap 713 -> 685 MB, 50,022 -> 20,025 listeners). Which BaseEdge props are extra attributes is read once from the keys present when the edge mounts.
