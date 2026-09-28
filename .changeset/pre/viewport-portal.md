---
"@dschz/solid-flow": patch
---

`ViewportPortal` renders into the viewport again, so its content pans and zooms with the graph. It looked for a container the flow never rendered and fell back to `document.body`. It now follows Svelte Flow's contract: content goes in front of the nodes by default, or behind the edges with `target="back"`, and other attributes (`class`, `style`, …) go on its wrapper `div`. The `ViewportPortalProps` type is exported.
