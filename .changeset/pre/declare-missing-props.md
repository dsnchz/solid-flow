---
"@dschz/solid-flow": minor
---

Declare `autoPanSpeed`, `panOnScrollSpeed`, and `ariaLiveMessage` as proper `SolidFlowProps`. The core already consumed all three, but they were never on the public type, so passing them was a type error. (Found by the new FLOW_PROP_KEYS compile-time contract.)
