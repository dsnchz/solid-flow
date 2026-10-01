---
"@dschz/solid-flow": patch
---

A selection box that started by clearing the selection could show nothing selected when its first move held exactly what the previous box had ended with (for example shift-dragging from the same node twice): the box compared against the previous gesture's result and skipped the write. It now compares against the selection as it stands when the box begins.
