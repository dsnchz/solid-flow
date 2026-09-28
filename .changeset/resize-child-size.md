---
"@dschz/solid-flow": patch
---

Resizing a parent node from its top or left edge no longer clears the `width` and `height` of its child nodes. The resizer repositions the children to keep them in place, and that position-only change used to write `undefined` over their size, so explicitly sized children collapsed to their content size.
