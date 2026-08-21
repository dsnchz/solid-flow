---
"@dschz/solid-flow": minor
---

Close the feature drift against Svelte Flow 1.6.3:

- **`zIndexMode` prop** (`'auto' | 'basic' | 'manual'`): controls automatic z-indexing. `'auto'` also manages stacking for sub flows via root-parent z increments, `'basic'` (default) elevates selections only, and `'manual'` disables automatic z-indexing entirely.
- **`autoPanOnSelection` prop**: the viewport now auto-pans when a drag selection approaches the edges of the container (enabled by default). The selection rectangle origin is anchored in flow space so it stays fixed on the canvas while panning.
- **`onSelectionChange` prop is now wired** — it previously existed in the types but never fired. It is called with `{ nodes, edges }` whenever the set of selected elements changes.
- **`<EdgeToolbar />` component**: renders a toolbar/tooltip for an edge inside a custom edge component, visible when the edge is selected (or controlled via `isVisible`).
- **New hooks**: `useNodesInitialized()`, `useViewportInitialized()`, and `useColorMode()` expose reactive access to node measurement state, pan/zoom readiness, and the resolved color mode.
- Drag selection now respects `paneClickDistance` before starting, handles `pointercancel`, and supports starting a selection on top of nodes while the selection key is held.
- `defaultMarkerColor` accepts `null` to defer to the `--xy-edge-stroke` CSS variable.
- `isValidConnection` is now generic over your edge type.
- Removed the dead legacy `EdgeUpdateAnchors` component (superseded by `EdgeReconnectAnchor`).
