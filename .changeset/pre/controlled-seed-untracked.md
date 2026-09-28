---
"@dschz/solid-flow": patch
---

Passing `nodes` or `edges` from a signal no longer triggers a `STRICT_READ_UNTRACKED` dev warning at mount. The flow reads the initial controlled arrays once at setup, on purpose (later changes arrive through its reset effects); those reads are now marked untracked.
