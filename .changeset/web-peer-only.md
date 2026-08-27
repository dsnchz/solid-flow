---
"@dschz/solid-flow": patch
---

Packaging fix: `@solidjs/web` was declared as BOTH a regular dependency and a peer dependency, which could give npm consumers a second nested copy of the Solid runtime (two reactive systems = broken context in confusing ways). It is now peer-only, and the `solid-js` peer range is restored to `^2.0.0-rc.0` (it had been accidentally exact-pinned). If your installation ever showed duplicate `solid-js`/`@solidjs/web` copies under `@dschz/solid-flow`, this resolves it.
