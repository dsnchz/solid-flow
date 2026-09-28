---
"@dschz/solid-flow": patch
---

Hydration works. A server-rendered flow failed to hydrate: client-only setup (window key listeners, the color-scheme media query, the pane's listeners, each node's and edge's element wiring) consumed hydration ids the server never produced, so every element after it missed its server markup and the client rendered a detached copy instead. That setup now runs outside the hydration id sequence while hydrating. A new hydration test lane server-renders flows and hydrates them in jsdom, asserting that every node and edge element is claimed, updates land in it, and the flow is interactive.
