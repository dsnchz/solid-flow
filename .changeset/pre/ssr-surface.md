---
"@dschz/solid-flow": patch
---

Server rendering: edges are now visible in server markup (they rendered with `visibility:hidden` because viewport culling engaged with no mounted container; culling now requires a DOM node), and the MiniMap renders its node shapes on the server instead of an empty panel (the SVG no longer waits for the pan-zoom instance, which only exists after mount). The README's server-side rendering section now states the full contract: edges need declared `handles`, NodeToolbar does not server-render, culling is off on the server, and async seeds suspend to the nearest `<Loading>` boundary.
