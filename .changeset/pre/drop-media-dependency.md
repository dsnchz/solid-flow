---
"@dschz/solid-flow": patch
---

Fewer runtime dependencies: `@solid-primitives/map`, `@solid-primitives/media`, `@solid-primitives/resize-observer` and `clsx` are gone (the color scheme is CSS-only now), which also drops `@solid-primitives/rootless` and `@solid-primitives/static-store` from installs. The remaining dependencies, `@solid-primitives/event-listener` 3.0.0 and `@xyflow/system` 1.0.0, are pinned exactly in both the npm and the JSR package; 0.2.x declared caret ranges, so installs could resolve versions the library was not tested with.
