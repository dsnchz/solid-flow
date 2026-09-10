---
"@dschz/solid-flow": patch
---

SolidJS 2.0.0-rc.7 support (trio in lockstep; the native compiler is now `@solidjs/compiler`). rc.7's store-engine diet lands directly on the 10k-node hot paths: node drag ~7.4 → ~5.8 ms/move (−22%), connection gesture ~2.85 → ~2.4 ms/move (−15%), drag first frame 32 → 26 ms, measured on production builds. Full gate and headless runtime matrix green.
