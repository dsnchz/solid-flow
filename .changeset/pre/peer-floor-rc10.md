---
"@dschz/solid-flow": patch
---

The `solid-js` and `@solidjs/web` peer ranges now start at `2.0.0-rc.10` (were `^2.0.0-rc.0`). The library is built and tested only against rc.10, earlier release candidates lack engine fixes filed from this library (solidjs/solid#3350, #3351, #3352, #3664, #3665), and Solid's release candidates rename internal exports between versions, so the old range admitted installs that could break at import time.
