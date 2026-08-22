---
"@dschz/solid-flow": patch
---

Fix the broken `./styles` export: 0.2.3 shipped `dist/styles/index.css` as a
raw copy of the source stylesheet, whose relative `@import`s point at files
that are not in the package — bundler consumers failed to resolve them and
plain `<link>` consumers silently lost all component styles. The build now
inlines the whole import tree into one flat file (as the pre-0.2.3 pipeline
did) and fails if any `@import` survives.
