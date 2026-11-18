---
"@dschz/solid-flow": patch
---

`selectionOnDrag` stays off while the left mouse button pans: with `panOnDrag` set to a button list that includes `0` (for example `[0, 2]`), a left drag on the pane now pans instead of panning and drawing a selection box at once, as in Svelte Flow 2. Only `panOnDrag={true}` turned it off before.
