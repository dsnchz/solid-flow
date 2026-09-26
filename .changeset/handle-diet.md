---
"@dschz/solid-flow": patch
---

Handle takes its defaults without a per-handle getter object and installs an attribute spread only when extra attributes are passed, so its own attributes compile to a static template instead of one spread re-collecting every attribute on any change (10k mount 2.6 s -> 2.3 s, heap 685 -> 651 MB). Which Handle props are extra attributes is read once from the keys present when the handle mounts; the attributes the handle sets itself keep winning over a colliding extra prop.
