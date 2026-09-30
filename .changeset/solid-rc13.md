---
"@dschz/solid-flow": patch
---

Requires solid-js / @solidjs/web `2.0.0-rc.13` or newer (the peer ranges were `^2.0.0-rc.10`). rc.13 removed `sharedConfig` from `solid-js` in favor of a public `isHydrating()`, which solid-flow now uses to keep client-only setup from consuming hydration ids; it also covers a streamed `<Loading>` boundary while it resumes, not only the root `hydrate()` pass. rc.13 carries the fix for solidjs/solid#3689 (keyed projection records paying O(keys) per added or deleted key in V8).
