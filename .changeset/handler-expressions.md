---
"@dschz/solid-flow": patch
---

The node selection box's keyboard handler and the MiniMap's click handler read their settings when an event arrives instead of in the handler expression. Solid 2.0 binds an element's handler once and, in development builds, reports `STRICT_READ_UNTRACKED` when the expression reads reactive state: showing the selection box warned through `disableKeyboardA11y`, and so did a MiniMap given `onClick` as a reactive expression.
