---
"@dschz/solid-flow": patch
---

Server rendering: the MiniMap renders its node shapes in server markup instead of an empty panel (the SVG no longer waits for the pan-zoom instance, which only exists after mount). A declared handle without `width` / `height` is laid out as 1x1, as in React Flow and Svelte Flow, so an edge between nodes that declare their own `handles` lays out without measured handle sizes. The README's server-side rendering section states the full contract: edges need both endpoint nodes to declare `handles`, `NodeToolbar` does not server-render, culling is off on the server, and async seeds suspend to the nearest `<Loading>` boundary.
