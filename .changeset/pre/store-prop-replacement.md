---
"@dschz/solid-flow": patch
---

Wholesale replacements on a store-backed `nodes`/`edges` prop
(`setNodes(() => nodes.map(...))`) now propagate into the flow. The
controlled-graph reset tracked the supplied array by reference, and a store
proxy's identity never changes — so on provider-adopted flows only draft
mutations worked and React Flow-style map-and-replace updates were silently
lost. The reset now tracks the array structurally (length + element
identity): replacements re-seed the internal root, field-level draft writes
still flow through without churn.
