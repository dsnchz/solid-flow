---
"@dschz/solid-flow": minor
---

New `useOnSelectionChange(onChange)` hook (React Flow / Svelte Flow parity): registers a selection listener from any component inside the flow. `onChange` receives `{ nodes, edges }` once on mount and then whenever the selected node or edge ids change, and the listener is removed when the component unmounts. It fires on the same rules as the `onSelectionChange` prop, which now shares its implementation.
