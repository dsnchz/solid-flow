---
"@dschz/solid-flow": patch
---

`@solid-primitives/event-listener` moves to 3.0.0-next.5, its latest prerelease (no code change from 3.0.0-next.3), and the JSR package now pins both `@solid-primitives` dependencies exactly, as the npm package does. JSR installs previously resolved them through caret ranges and could pick up prereleases the library was not tested with.
