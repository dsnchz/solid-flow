---
"@dschz/solid-flow": patch
---

`clickConnect` now takes effect when it changes after mount. Handles decided at creation whether to listen for click-to-connect, so turning the prop on or off later did nothing for handles already rendered. The dev engine had been reporting this as a `STRICT_READ_UNTRACKED` warning from `<Handle>`, one per handle, on every mount.
