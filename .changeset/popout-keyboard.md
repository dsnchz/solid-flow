---
"@dschz/solid-flow": patch
---

Keyboard shortcuts work in a flow rendered into another window (a same-origin popout from `window.open`, rendered with a portal): the delete key, the selection, multi-selection, pan and zoom activation keys, and `useKeyPress` inside the flow listen to the window the flow is in. They listened to the opener's window, so keys pressed in the popout did nothing and keys pressed in the opener acted on the popout's flow (xyflow#6124).
