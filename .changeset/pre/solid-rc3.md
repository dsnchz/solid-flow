---
"@dschz/solid-flow": patch
---

SolidJS 2.0.0-rc.3 support. rc.3 fixes the node-build store-setter defect we reported (solidjs/solid#3064), narrowing the headless-node gap to one remaining upstream issue we isolated and filed during verification: the node build never re-derives `createProjection` after source changes (solidjs/solid#3073). Browser builds, jsdom, and SSR rendering remain unaffected; production drag performance is at parity with rc.2.
