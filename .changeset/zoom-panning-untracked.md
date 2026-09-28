---
"@dschz/solid-flow": patch
---

A programmatic viewport change (`setViewport`, `fitView`, the Controls) no longer prints a `STRICT_READ_UNTRACKED` dev warning. The pan-zoom callback checks whether a pan is already in progress; that one-time read is now marked untracked.
