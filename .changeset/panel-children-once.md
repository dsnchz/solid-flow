---
"@dschz/solid-flow": patch
---

`<Panel>` (and so `Controls`, `MiniMap` and the attribution) rendered its children twice on every mount and kept the second copy: the prop-defaults helper read each prop twice, and a JSX `children` getter renders on every read. It now reads once.
