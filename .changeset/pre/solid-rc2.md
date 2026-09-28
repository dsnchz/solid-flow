---
"@dschz/solid-flow": patch
---

SolidJS 2.0.0-rc.2 support: the reactive-graph workarounds for solidjs/solid#3037 (first-nested-derive subscription stranding) are deleted now that the fix ships upstream, and rc.2's fix for solidjs/solid#3038 (the companion-walk flush cost we reported) makes 10k-node drags ~14% faster in production builds. Known upstream issue filed during verification: rc.2's node build ignores store setters that return a replacement array (solidjs/solid#3064) — browser builds, jsdom, and SSR rendering are unaffected.
