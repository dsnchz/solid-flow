---
"@dschz/solid-flow": patch
---

Dragging a node while the MiniMap is shown no longer overflows the call stack when two nodes name each other as `parentId`. The minimap follows each node's parent to find the nodes a drag moves, and a node now reports a parent only when it is positioned from it, which never happens on a cycle.
