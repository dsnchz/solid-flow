---
"@dschz/solid-flow": patch
---

Fix the broken `./styles` export (also released as 0.2.4): the build shipped
`dist/styles/index.css` with relative `@import`s pointing at files not in the
package. The import tree is now inlined into one flat file and the build
fails if any `@import` survives.
