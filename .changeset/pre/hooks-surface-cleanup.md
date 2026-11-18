---
"@dschz/solid-flow": minor
---

New hooks, for React Flow and Svelte Flow parity:

- `useNodeId` and `useEdgeId` are public: learn which node or edge a nested component is rendered inside (composable custom nodes and edge labels without prop drilling).
- Element hooks matching upstream's latest additions (xyflow#5868): `useNode`, `useEdge`, `useSelectedNodes`, `useSelectedEdges`, all reactive; `useNode` and `useEdge` take the id as an `Accessor`.
- `useKeyPress`: reactive key and combo tracking usable anywhere, hardened beyond upstream: combos re-activate when the base key is pressed again while the modifier stays held (fixing the pattern behind xyflow#2248), and stuck modifiers self-heal from later input events.
- `useOnSelectionChange(onChange)`: registers a selection listener from any component inside the flow. `onChange` receives `{ nodes, edges }` once on mount and then whenever the selected node or edge ids change, and the listener is removed when the component unmounts. It fires on the same rules as the `onSelectionChange` prop.

The `onSelectionChange` prop is subscribed only while a handler is set, as in React Flow, and a handler set after mount is now called with the current selection (it was not called until the selection next changed).

Breaking: `useHandleEdgeSelect` is removed (internal plumbing that was never meant for apps; select edges through `commands` instead).
