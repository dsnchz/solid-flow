---
"@dschz/solid-flow": patch
---

Harden input state against focus loss (fixes two long-standing upstream xyflow bugs on our side):

- Stuck modifier keys self-heal (xyflow/xyflow#5679): OS overlays like the macOS screenshot HUD swallow the keyup without blurring the window, leaving selection/multi-selection/zoom-activation state stuck "held". Every subsequent keyboard, pointer, or wheel event now reconciles stored key state against the event's actual modifier flags before anything reads it.
- Window blur finalizes in-flight pointer gestures (xyflow/xyflow#5852): Alt+Tab while holding the mouse button meant the window-level release never arrived, so the node (or pan, or connection line) kept chasing the cursor after refocus. Blur now dispatches a synthetic window release that cleanly ends any active d3-drag/d3-zoom/XYHandle gesture at its last position.
