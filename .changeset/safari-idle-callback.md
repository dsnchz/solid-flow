---
"@dschz/solid-flow": patch
---

Fix Safari compatibility: `requestIdleCallback` is not available in Safari, which broke node measurement. Internal scheduling now falls back to a macrotask where the API is missing. (#19)
