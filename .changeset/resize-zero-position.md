---
"@dschz/solid-flow": patch
---

Resizing a node from its top or left edge now moves it when the new position has a 0 coordinate. A node on the `y: 0` line (or landing on `x: 0`) used to keep its old position while its size changed, so it grew in the wrong direction.
