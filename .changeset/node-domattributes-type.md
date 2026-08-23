---
"@dschz/solid-flow": patch
---

`Node.domAttributes` is typed again: a mistranslated omit clause
(`keyof JSX.HTMLAttributes` — i.e. everything) had collapsed the escape
hatch to `{}`, disabling autocomplete and checking entirely. It now accepts
plain attributes while excluding event handlers, refs, and content
injection, matching Svelte Flow's intent.
