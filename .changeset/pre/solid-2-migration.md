---
"@dschz/solid-flow": minor
---

Migrate to Solid 2.0 (`solid-js@2.0.0-rc.x` + `@solidjs/web`). This is the first release of the 2.0 line, published under the `next` tag.

**Breaking changes** (0.x semantics: breaking changes ride minor versions):

- Peer dependencies are now `solid-js@^2.0.0-rc.0` and `@solidjs/web@^2.0.0-rc.0`. Solid 1.x is no longer supported on this line (stay on `0.2.x` for Solid 1.x).
- `jsxImportSource` for consumers compiling against the `solid` export condition is `@solidjs/web`.

**Internals modernized for Solid 2.0**:

- Two-argument `createEffect(compute, apply)` throughout — effects exist only at external-system boundaries (xyflow/system controllers, ResizeObserver, DOM focus)
- Deferred-read semantics handled at gesture seams (`flush()` at key-state, selection, and connection boundaries)
- `clsx` dependency removed in favor of native `class` array/object forms
- Connection lookup now stores immutable per-key snapshots, fixing missed `onConnect`/`onDisconnect` callbacks for handles with multiple connections and for partial removals
- Handle measurement no longer races the node ref on initial mount (edges failing to appear on first paint)
- Prop defaulting no longer lets explicitly-forwarded `undefined` props clobber child defaults (mispositioned handles)
- DOM listeners wired through `@solid-primitives/event-listener`; media queries through `@solid-primitives/media`

Public API (props, components, hooks), the SSR contract, and the `solid` export condition are unchanged.
