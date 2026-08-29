# @dschz/solid-flow

## 1.0.0-next.14

### Patch Changes

- 6fbb387: Completed connections are no longer written into a controlled edges store. The completion write pierced into the user's store (the internal store wraps their proxy), so the documented `onConnect` adoption push produced a duplicate row with the same id — invisible in the DOM (the derived edge record is keyed by id) but persisted by `toObject()`. Connection completion is now a no-op on a controlled axis: the connection reaches you only through `onConnect`, and adopting it is what makes it exist (unadopted connections are dropped). Uncontrolled flows (`defaultEdges`) are unchanged — the flow owns membership and inserts the edge itself. Playground examples that relied on the auto-insert now adopt, and the README/llms.txt ownership contract is updated to match.
- 5f1bb81: The public types for `Position`, `ConnectionLineType`, `ConnectionMode`, `MarkerType`, `PanOnScrollMode`, `ResizeControlVariant`, and `SelectionMode` are now string unions instead of the nominal upstream enums — `const p: Position = "right"` and literal-typed helpers now typecheck (every prop already accepted literals). The exported member objects are unchanged (`Position.Top` still compiles everywhere and remains required for system-typed node fields like `sourcePosition`).

## 1.0.0-next.13

### Minor Changes

- 2a3363a: Typed optimistic store factories: `createOptimisticNodeStore` / `createOptimisticEdgeStore` — guided-union twins of the plain factories for the per-mutation sync pattern, mirroring the full core surface: an inline array, an async function, or an async generator (`data` narrowed by `type`; the derived forms keep the `Refreshable` brand so `refresh()` typechecks). Purely a typing convenience: a raw `createOptimisticStore` composes with the flow identically.

### Patch Changes

- 7619b3f: SolidJS 2.0.0-rc.4 support. rc.4 ships the fix for the torn mid-action reads through derived stores that our optimistic-compat questions surfaced upstream (solidjs/solid#3089) — our contract spikes confirm the mid-action read artifact is gone, the full runtime matrix stays green, and drag performance improved slightly (mean ~4.7 → ~3.7 ms/move at 10k nodes).

## 1.0.0-next.12

### Minor Changes

- ee73976: Live flows: `createNodeStore` / `createEdgeStore` now accept an async **generator** source — "a value that keeps arriving". The store is unsettled until the first yield, then every yield streams into the graph with fine-grained updates: membership changes, node moves, and removals all flow through. Paired with a `live()` server function this is a server-pushed, collaborative flow in a handful of lines — see the new LiveFlow playground example and the "Live flows" README section.

### Patch Changes

- e7d2d33: The sidecar release effect now confirms against row proxies captured at write time instead of resolving rows through the keyed lookup records — pulling a derived record inside the write flush triggered an O(sources) marking wave. Drag-start first frame at 10k nodes drops from ~250ms to ~45ms (~35x faster than two releases ago), and drag mean improves to ~4.7 ms/move.

## 1.0.0-next.11

### Minor Changes

- 89a0993: Drag positions are now sidecar-backed (third slice of the solid#3085 composition): per-frame gesture positions live in a flow-owned overlay joined at read time, so dragging works — and dragged positions persist, including across `refresh()` reconciles — over `createOptimisticStore` inputs. The parity contract is unchanged for plain stores: your rows stay live during the drag, later position writes through your own store govern, and undo back to the exact pre-drag position works.
- f3a2005: Measurements are now sidecar-authoritative (second slice of the solid#3085 composition, after selection): rendering and `nodesInitialized` read the flow-owned measurements root joined with your rows, so both work correctly over `createOptimisticStore` inputs where the row write-through reverts. Precedence change: a fresh DOM measurement now supersedes a user-seeded `measured` value (previously the user seed always won); user-seeded `measured` still governs the pre-measurement window (SSR sizing, persisted layouts), and the write-through onto your rows remains for plain stores.
- 7402b1f: Full `createOptimisticStore` support — the final slice. Membership is now rendered from the user-facing store (a derived record's enumeration doesn't surface optimistic membership edits mid-action; direct row reads do), so an optimistic node/edge add appears immediately mid-action, a rejected action reverts the flow cleanly, and flow commands work inside open action transactions. `updateNode`/`updateEdge` route `selected` through the selection sidecar, so programmatic selection composes over optimistic stores like gesture selection. Together with the selection, drag-position, and measurement sidecars, the optimistic-compat acceptance suite is fully green: Solid Flow now composes with the part-2 "Write Sync, Run Async" pattern end to end.
- fb606a2: Selection is now sidecar-backed — the composition recommended by the SolidJS team in solidjs/solid#3085. Flow-driven selection lives in a library-owned keyed overlay joined with your rows at read time, with best-effort write-through onto your rows preserving the existing contract (reading `selected` off your store stays live for plain stores, and user writes to `selected` through your own store still govern). The payoff: selection now works and persists over `createOptimisticStore` inputs — clicks select, deselects route correctly, and selection survives `refresh()` reconciles — the first slice of full optimistic-store support. Internal nodes now always carry an explicit `selected` boolean (previously absent when the user row had none).

### Patch Changes

- 824cf89: Drag-start cost at 10k nodes cut ~6.5x (first gesture frame 1605ms → ~250ms; drag mean 16.5 → 6.3 ms/move), root-caused by CPU profiling: `unselectNodesAndEdges` deselected every element unconditionally (now O(actually-selected) via the joined views), the selection views were whole-graph filter memos rebuilding two subscriptions per element per recompute (now keyed presence projections with O(changed) updates), and the internal record facade's `in`-first probe subscribed every keyed consumer record-wide (now a present-key fast path). The spike predates the sidecar work — it was invisible in mean-only benchmarks.

## 1.0.0-next.10

### Minor Changes

- 2e1cd74: `defaultNodes` / `defaultEdges` now accept rows from an async-seeded store — "seed the flow from server truth". While the source is pending the flow seeds empty (cover it with `<Loading>` if desired) and adopts the rows when the data settles; previously this was a hard `PENDING_ASYNC_UNTRACKED_READ` error. This enables the documented draft-then-commit persistence pattern (new README section + Persistence playground example): server truth in an async store outside the flow, edits accumulating in the flow-owned draft, one action batch-submitting `toObject()` — a failed save keeps the draft, and the refresh reconcile can't clobber edits. Passing a `createOptimisticStore` as `nodes`/`edges` is documented as unsupported (flow-internal writes would revert with the overlay).
- 2e1cd74: Event-callback parity with React Flow: `onNodeDoubleClick`, `onEdgeDoubleClick`, `onEdgePointerMove`, `onPaneScroll`, `onPanePointerEnter` / `onPanePointerMove` / `onPanePointerLeave`, and `onViewportChange` (fires on every viewport change, programmatic ones included). The event surface now covers everything Svelte Flow exposes plus the React Flow set, except `onNodesChange`/`onEdgesChange`, which don't exist by design in a store-based flow.

### Patch Changes

- c9b4048: Ship an `llms.txt` agent cheatsheet in the npm and JSR packages: a compact, agent-oriented map of the API that front-loads what an agent trained on React Flow gets wrong here (no change reducers, store-based state, pointer-named events, Solid 2.0 async rules, draft-then-commit persistence).

## 1.0.0-next.9

### Minor Changes

- 2f2fff5: New element hooks matching upstream's latest additions (xyflow#5868): `useNode`, `useEdge`, `useSelectedNodes`, `useSelectedEdges` — all reactive, all Accessor-input. Plus a pinned immunity suite for upstream bugs Solid Flow dodges structurally: connections and MiniMap panning survive full flow remounts (xyflow#5971/#5933), `setNodes` inside `onNodeDrag` doesn't freeze the dragged node (xyflow#4760), edges never leave the DOM when nodes are added (xyflow#5970), non-adjacent edges aren't re-laid-out by node moves (the failure mode behind xyflow#5958), and the pan-activation key enables primary-button panning with `panOnDrag` off (xyflow#5923). New Remount playground example.

### Patch Changes

- ab5e00a: SolidJS 2.0.0-rc.3 support. rc.3 fixes the node-build store-setter defect we reported (solidjs/solid#3064), narrowing the headless-node gap to one remaining upstream issue we isolated and filed during verification: the node build never re-derives `createProjection` after source changes (solidjs/solid#3073). Browser builds, jsdom, and SSR rendering remain unaffected; production drag performance is at parity with rc.2.
- c5d0e04: Bump `@xyflow/system` to 0.0.81, inheriting upstream fixes for rapid-pinch viewport corruption (xyflow#5949), fitView with never-measured hidden nodes (xyflow#5841), and multi-select-rectangle panning (xyflow#5878). The `ProOptions` type (removed from system's exports) is now defined and exported by Solid Flow directly — no API change for consumers importing it from `@dschz/solid-flow`.
- 5603274: Packaging fix: `@solidjs/web` was declared as BOTH a regular dependency and a peer dependency, which could give npm consumers a second nested copy of the Solid runtime (two reactive systems = broken context in confusing ways). It is now peer-only, and the `solid-js` peer range is restored to `^2.0.0-rc.0` (it had been accidentally exact-pinned). If your installation ever showed duplicate `solid-js`/`@solidjs/web` copies under `@dschz/solid-flow`, this resolves it.

## 1.0.0-next.8

### Minor Changes

- f5d3995: Two parity features: `useKeyPress` (reactive key/combo tracking usable anywhere — hardened beyond upstream: combos re-activate when the base key is re-pressed while the modifier stays held, fixing the pattern behind xyflow#2248, and stuck modifiers self-heal from later input events) and MiniMap `offsetScale` (scales the padding around the graph, default 5 — the last MiniMap parity gap).

### Patch Changes

- 3c0a946: Two more large-graph wins (benchmarked at 10k nodes): connection gestures now average 2.4ms per move with no start-of-gesture hitch (was a ~490ms spike — the possible-target handle affordance is derived from root-level classes in CSS instead of a per-handle computation), and dragging with the MiniMap open costs the same as without it (76 → 17ms/move — graph bounds are sampled per animation frame during drags instead of tracked through the reactive lookup). Breaking for custom CSS only: handles no longer emit the `connectionindicator` class; target `.solid-flow.connecting .solid-flow__handle.connectable.connectableend` (see handle styles) instead.
- 36ddea3: Consistency sweep (audit WP4): all runtime warnings route through `onFlowError` (one error channel, console fallback); unknown node/edge types now render the `default` component instead of nothing, reporting error003/error011 (upstream parity); the internal layouted-edge accessor is named `getLayoutedEdge` to stop shape confusion with the raw `edgeLookup`; `useNodes`/`useEdges` read the public flow surface; duplicated internals unified (the XYHandle gesture params shared by Handle and EdgeReconnectAnchor — fixing a silent validation-handling divergence — the keyed-record projection tail, and the renderers' focus tracker); ConnectionLine and MiniMap drop all non-null assertions in favor of narrowed types; MiniMap attribute callbacks (`nodeColor` etc.) now receive the user node, matching upstream.

## 1.0.0-next.7

### Minor Changes

- e437fd1: Async-seeded stores: `createNodeStore` / `createEdgeStore` now also accept `async () => data` (SolidJS 2.0 "Fetch High") — no memo required, the function goes straight to the store's projection derive. Reads are not-ready until the data lands, and `SolidFlow` surfaces that first-load pending state to your `<Loading fallback>` boundary — including for provider-adopted flows — instead of silently rendering an empty graph. After the seed resolves the stores are ordinary writable stores (drafts, connection adoption, wholesale replacement). New AsyncData playground example + "Loading your graph from an API" README section.
- 486f358: Declare `autoPanSpeed`, `panOnScrollSpeed`, and `ariaLiveMessage` as proper `SolidFlowProps`. The core already consumed all three, but they were never on the public type, so passing them was a type error. (Found by the new FLOW_PROP_KEYS compile-time contract.)

### Patch Changes

- 486f358: Bug sweep from the 2026-08-24 quality audit, every fix with a regression test:

  - `nodesConnectable` prop was inert (a copy-paste wired it to `nodesDraggable`).
  - The flow `id` (default `"1"`) leaked onto the root element as a DOM id, producing duplicate ids across flows; delete callbacks leaked as bogus DOM listeners. Flow props are now stripped via an exported `FLOW_PROP_KEYS` list whose completeness is a compile-time contract, so omit-list drift is a type error.
  - A user `style` on a node could override the flow-computed width/height (defeating measured size), culling visibility, transform, and z-index. Ownership is now explicit: user style controls cosmetics; the flow owns size, stacking, positioning, visibility, and pointer-events.
  - Programmatic `deleteElements()` never fired `onDelete` (only the Backspace path did). All delete paths now notify identically.
  - `screenToFlowPosition` always snapped to a `[1, 1]` grid because its snap guard could never be false; fractional positions now survive when snapping is off.
  - Edge selectability was resolved three different ways — box selection ignored `elementsSelectable` entirely, selecting edges a click could not. One `isEdgeSelectable` rule (edge flag, then `defaultEdgeOptions.selectable`, then `elementsSelectable`) now serves every path.
  - `getIntersectingNodes` crashed on an unknown node id instead of returning `[]`.
  - The measurement pass now receives the flow-level `nodeExtent`, aligning `expandParent` rect math with the projection's clamping rule.
  - Removed the vestigial `reconnectRadius` threading and the dead unexported `EdgeAnchor` component (our reconnection API is Svelte-parity: you render your own anchor children).

- 0a42977: Performance sweep (benchmarked before/after at 2.5k and 10k nodes):

  - **MiniMap is now usable on large graphs.** Its viewBox/mask math re-ran ~30 unmemoized full-graph bounds scans per drag/pan frame — 1.5 seconds per mouse move at 2,500 nodes, and a hard freeze at 10,000. One memo chain later it's 20ms/move at 2.5k (74x) and 76ms at 10k (from frozen). Also fixed: pre-measurement graphs produced an Infinity bounds rect that could poison the shared viewport with NaN through the minimap's pan controller.
  - Box selection membership is a Set instead of per-node `ids.includes` (was O(nodes x selection)).
  - `store.nodeTypes` / `edgeTypes` / `connection` / `selectedNodes` / `selectedEdges` no longer allocate on every read (memoized); `actions.setViewport` has a stable identity; the selection box computes its bounds once per change instead of 7x per render; edge pointer handlers are wired directly.

- 52b75d1: SolidJS 2.0.0-rc.2 support: the reactive-graph workarounds for solidjs/solid#3037 (first-nested-derive subscription stranding) are deleted now that the fix ships upstream, and rc.2's fix for solidjs/solid#3038 (the companion-walk flush cost we reported) makes 10k-node drags ~14% faster in production builds. Known upstream issue filed during verification: rc.2's node build ignores store setters that return a replacement array (solidjs/solid#3064) — browser builds, jsdom, and SSR rendering are unaffected.
- e355096: Spatial queries (benchmarked at 10k nodes): connection drags are now interactive on large graphs — per-move cost went from ~422ms (every pointermove ran upstream's full node scan PLUS a ~20k-handle reactive fan-out) to ~5ms median / 17ms p95, a 31x mean improvement. Three pieces: a gesture-scoped spatial grid feeds XYHandle's closest-handle search from the pointer's neighborhood (node geometry is frozen during gestures, so the snapshot is exact); handles subscribe to equality-cut connection state instead of the per-move connection object; and the hover-target is a keyed record, so snapping onto a handle touches two handles instead of all of them. Box selection narrows its per-move sweep through the same grid, and `getIntersectingNodes` shares one grid build across same-task calls (the per-dragged-node collision pattern drops from N full scans to one build + N neighborhood queries; it remains a snapshot/pull API).
- 3dbf594: Internal restructuring (WP3): the controlled/uncontrolled seeding policy, the measurement ingest lifecycle, and the selection command group now live in their own headless-testable core modules; dead internals removed (unused signal setters, unread store getters, a triply-plumbed pane click-distance path, vestigial actions). Behavioral fix riding along: `addSelectedEdges` now uses Set membership like `addSelectedNodes` (was O(edges x selection) per box selection).

## 1.0.0-next.6

### Major Changes

- a376b55: Solid Flow 1.0 — built for SolidJS 2.0.

  The 0.3.0 prerelease line graduates to 1.0: the library is a ground-up rebuild on SolidJS 2.0's reactive foundation (draft-based store writes, deferred updates, the two-arg effect model) with a deliberately redesigned public API. From 1.0 on, breaking changes cost a major — the 0.x escape hatch is closed.

  Highlights of the line (see the 0.3.0-next.\* entries below for details):

  - Controlled node/edge stores with a clear ownership contract: your store owns membership, the flow writes runtime fields onto shared row objects; any write form works (drafts are O(changed), wholesale replacement re-seeds with keyed row reuse).
  - Two-tier viewport culling: an always-on CSS tier, plus opt-in `onlyRenderVisibleElements` unmount culling (at 10k nodes: ~16x less DOM, ~half the heap, ~3.7x faster drags) with `cullable: false` per-element opt-out.
  - Typed component schemas: `NodeProps`/`EdgeProps` with `SolidFlowNode`/`SolidFlowEdge` guided unions, `satisfies`-friendly everywhere.
  - Feature parity gaps closed (MiniMap custom nodes and click handlers, edge reconnection, SSR) plus fixes for issues still open upstream in xyflow (stuck modifier keys after OS overlays, drags surviving window blur, connection-line clipping).

  Requires `solid-js` and `@solidjs/web` 2.x. The 0.2.x line remains the SolidJS 1.9+ maintenance line.

### Minor Changes

- 941c08a: Rename the guided union types: `NodesFor` → `SolidFlowNode` and `EdgesFor` → `SolidFlowEdge` (breaking for prerelease users of the old names; no aliases kept — the stable 1.0 ships only the new names). The old names only read well with an explicit argument (`NodesFor<typeof nodeTypes>`); the new ones read correctly bare too (`satisfies SolidFlowNode[]`). Semantics are unchanged: element-level unions narrowed by your renderer map, `satisfies`-friendly anywhere.
- 2b61ff8: Uncontrolled flows via `defaultNodes` / `defaultEdges` (React Flow parity). When you pass defaults instead of the controlled `nodes` / `edges` props, the flow owns element state: the arrays seed it once (later values are ignored), and membership belongs to the flow — commands like `addNodes` / `deleteElements` and completed connections write through and persist, with no adoption step. The two axes are independent (nodes and edges can each be controlled or uncontrolled), the mode works under `SolidFlowProvider`, and supplying both props on one axis warns in dev with the controlled prop winning. See "Who owns the data" in the README and the new Uncontrolled playground example.

## 0.3.0-next.5

### Minor Changes

- defdaae: Add `cullable: false` on nodes and edges to exempt an element from viewport culling on both tiers: the always-on CSS tier never hides it and `onlyRenderVisibleElements` never unmounts it. Use it for elements whose content must keep running off-screen (media playback, timers, third-party embeds). Fills the gap tracked upstream as xyflow/xyflow#5487.

### Patch Changes

- defdaae: Fix `onlyRenderVisibleElements` starving pre-measured nodes of their first mount. A node arriving with `measured` already set (persisted layout, SSR payload, or a remounted flow reusing the same node objects) was unmount-culled before ever mounting, so its handle bounds never populated in that flow instance and every edge touching it silently failed to lay out. Off-viewport nodes now always mount once until their handle bounds exist.
- 2c56a55: Harden input state against focus loss (fixes two long-standing upstream xyflow bugs on our side):

  - Stuck modifier keys self-heal (xyflow/xyflow#5679): OS overlays like the macOS screenshot HUD swallow the keyup without blurring the window, leaving selection/multi-selection/zoom-activation state stuck "held". Every subsequent keyboard, pointer, or wheel event now reconciles stored key state against the event's actual modifier flags before anything reads it.
  - Window blur finalizes in-flight pointer gestures (xyflow/xyflow#5852): Alt+Tab while holding the mouse button meant the window-level release never arrived, so the node (or pan, or connection line) kept chasing the cursor after refocus. Blur now dispatches a synthetic window release that cleanly ends any active d3-drag/d3-zoom/XYHandle gesture at its last position.

## 0.3.0-next.4

### Minor Changes

- e50a170: Edge reconnection works end-to-end. Fixed: `EdgeReconnectAnchor` passed the
  connection updater to XYHandle without a flush, so under Solid 2.0's
  deferred model the gesture's synchronous read-back saw a stale (null)
  `fromHandle` and never matched a drop handle — every reconnect ended with
  `isValid: null` and no edge update. The anchor also gained
  `onReconnectingChange` (the Solid translation of Svelte Flow's
  `bind:reconnecting`) and now honors its `reconnecting` prop as a controlled
  override; a new EdgeReconnect playground example demonstrates the
  selected-edge anchor pattern.
- 612bd96: The guided node/edge unions behind `createNodeStore`/`createEdgeStore` are
  now exported as `NodesFor<typeof nodeTypes>` / `EdgesFor<typeof edgeTypes>`,
  so the same per-type data narrowing works on plain arrays, props, and
  vanilla stores (`satisfies NodesFor<...>[]`). The unions are also more
  robust: the `type` discriminant is now the renderer-map KEY (what actually
  gets matched), components with odd-but-legal signatures degrade to open
  data instead of collapsing their key to `never`, and omitting the generic
  still rejects custom type names loudly (`NoInfer` guards the argument).
- 34b904f: Hooks surface cleanup for React/Svelte Flow parity: `useNodeId` and
  `useEdgeId` are now public (learn which node/edge a nested component is
  rendered inside — composable custom nodes and edge labels without prop
  drilling). BREAKING: `useHandleEdgeSelect` is removed (internal plumbing
  that was never consumed; select edges through `commands` instead).
- 9ac39c9: `MiniMap` supports `onClick` (pane click, receiving the position in flow
  coordinates) and `onNodeClick` (receiving the clicked user node) — React
  Flow parity. Custom `nodeComponent`s receive the wired `onClick` through
  `MiniMapNodeProps`.
- c198c96: `MiniMap` supports a custom `nodeComponent` (React Flow parity): render your
  own SVG representation per node, receiving the exported `MiniMapNodeProps`
  (id, flow-space geometry, colors, selection, and the node's own style —
  whose background also now feeds the default rect's fill, matching upstream).
  The default `MiniMapNode` is exported for composition.
- f018c60: BREAKING: the deprecated imperative getters on `useSolidFlow()` are removed
  (`getNode`, `getNodes`, `getEdge`, `getEdges`, `getViewport`, `getZoom`,
  `getInternalNode`, `getHandleConnections`) — read the same state from `flow`
  instead (`flow.nodes`, `flow.internalNodes[id]`, `flow.viewport`,
  `flow.connections`); in Solid, reads inside event handlers are already
  untracked, so no getter wrapper is needed. `useNodes()` and `useEdges()` now
  return `readonly` arrays — mutate through commands, not array methods.
- 5ef430e: **Breaking (prerelease line):** `onlyRenderVisibleElements` is repurposed to
  mean what its name says — true conditional rendering — and its default flips
  to `false`. Off-viewport nodes and edges are unmounted entirely and remount
  as the viewport reaches them, matching React/Svelte Flow's semantics for the
  prop. At 10k nodes this cuts the DOM ~16x, roughly halves memory, and makes
  node drags ~3.7x faster (unmounting removes most live observers from the
  reactive graph). The data graph is unaffected: positions, selection, and
  cached measurements live outside the components, so remounted elements come
  back exactly as they left. Component-local state (signals inside custom
  nodes, uncontrolled inputs) does not survive unmounting — keep state in
  `node.data`. Never unmounted: selected elements, unmeasured nodes, and the
  element holding DOM focus.

  The previous CSS culling behavior (hide off-viewport elements with
  `visibility: hidden` + `pointer-events: none`, everything stays mounted) is
  now always on and no longer tied to this prop — it is semantics-preserving
  and needs no switch. `CullingSource` accordingly lost its
  `onlyRenderVisibleElements` field.

  Also fixed: `NodeWrapper` now unobserves its element from the shared
  measurement `ResizeObserver` on dispose (previously removed nodes stayed
  pinned in the observer's target list).

### Patch Changes

- 6bce414: Fix the in-progress connection line clipping at a hard boundary and
  rendering beneath nodes: a mangled CSS selector (`connectionline` instead of
  `.solid-flow__connectionline`) meant the line's svg never received
  `overflow: visible`, `z-index: 1001`, or `position: absolute`, so the path
  scissored at the svg box (flow-origin) and its near-node segment hid behind
  the node body.
- 040153e: Fix the `cross` background variant rendering as a blank pane: a flat
  `size: 1` prop default preempted the per-variant default size (cross needs
  6), shrinking each cross to an invisible ~1px speck.
- 628dc25: `Node.domAttributes` is typed again: a mistranslated omit clause
  (`keyof JSX.HTMLAttributes` — i.e. everything) had collapsed the escape
  hatch to `{}`, disabling autocomplete and checking entirely. It now accepts
  plain attributes while excluding event handlers, refs, and content
  injection, matching Svelte Flow's intent.
- 3eb07c9: Wholesale replacements on a store-backed `nodes`/`edges` prop
  (`setNodes(() => nodes.map(...))`) now propagate into the flow. The
  controlled-graph reset tracked the supplied array by reference, and a store
  proxy's identity never changes — so on provider-adopted flows only draft
  mutations worked and React Flow-style map-and-replace updates were silently
  lost. The reset now tracks the array structurally (length + element
  identity): replacements re-seed the internal root, field-level draft writes
  still flow through without churn.

## 0.3.0-next.3

### Patch Changes

- Documentation: every exported symbol now carries JSDoc, including documented
  re-declarations of the `@xyflow/system` types whose upstream declarations are
  undocumented (new `types/system` module). No runtime changes.

## 0.3.0-next.2

### Minor Changes

- a5ee8b3: `onlyRenderVisibleElements` now defaults to `true` and culls with CSS instead
  of unmounting: off-screen nodes and edges stay mounted and get
  `visibility: hidden` + `pointer-events: none`, so custom-node DOM state
  survives off-screen, measurement/fitView/minimap are unaffected, and there is
  no mount/unmount churn while panning. The visible set derives from an
  overscanned, quantized viewport, so panning inside the margin does zero work
  (measured: pan p95 unchanged vs culling off at 1600 and 10k nodes; recomputes
  only on quantization-boundary crossings). Selected elements are never culled.
  Pass `onlyRenderVisibleElements={false}` to keep every element visible — note
  culled elements leave the accessibility tree and tab order while off-screen,
  and keeping everything mounted still costs memory at large graph sizes.

## 0.3.0-next.1

### Minor Changes

- The data graph is now one public reactive struct. `useSolidFlow()` returns
  `{ flow, commands }` — `flow` is the canonical read surface (`FlowState`:
  graph roots, `internalNodes`/`layoutedEdges`/`connections` records,
  `selection`, viewport, interaction and config state; every property read in a
  tracked scope is a live subscription) and `commands` is the write surface
  (`FlowCommands`), with every command also spread onto the returned object for
  upstream familiarity. New public commands: `setNodes`, `setEdges`, `panBy`,
  and `updateNodeInternals`. The imperative getters (`getNode`, `getNodes`,
  `getEdge`, `getEdges`, `getViewport`, `getZoom`, `getInternalNode`,
  `getHandleConnections`) are deprecated in favor of `flow` reads and will be
  removed before 0.3.0 stable. The sugar hooks remain as one-line conveniences
  over the struct. `FlowState`, `FlowSelection`, `FlowCommands`,
  `ConnectionsRecord`, and `connectionKey` are exported from the package
  entrypoint.

### Patch Changes

- Fix the broken `./styles` export (also released as 0.2.4): the build shipped
  `dist/styles/index.css` with relative `@import`s pointing at files not in the
  package. The import tree is now inlined into one flat file and the build
  fails if any `@import` survives.
- Per-row sub-store architecture for the internal node and edge projections:
  each row is its own keyed projection and the public records are shallow
  projections of the row proxies. Dragging one node now costs O(changed) work —
  0.51ms per move at 625 nodes and 1.37ms at 1600 (from 19.4ms), at parity with
  the 0.2.x line at every scale measured, with identical fine-grained DOM
  output.

## 0.3.0-next.0

### Minor Changes

- Migrate to Solid 2.0 (`solid-js@2.0.0-rc.x` + `@solidjs/web`). This is the first release of the 2.0 line, published under the `next` tag.

  **Breaking changes** (0.x semantics: breaking changes ride minor versions):

  - Peer dependencies are now `solid-js@^2.0.0-rc.0` and `@solidjs/web@^2.0.0-rc.0`. Solid 1.x is no longer supported on this line (stay on `0.2.x` for Solid 1.x).
  - `jsxImportSource` for consumers compiling against the `solid` export condition is `@solidjs/web`.

  **Internals modernized for Solid 2.0**:

  - Two-argument `createEffect(compute, apply)` throughout — effects exist only at external-system boundaries (xyflow/system controllers, ResizeObserver, DOM focus)
  - Deferred-read semantics handled at gesture seams (`flush()` at key-state, selection, and connection boundaries)
  - `clsx` dependency removed in favor of native `class` array/object forms
  - Connection lookup now stores immutable per-key snapshots, fixing missed `onConnect`/`onDisconnect` callbacks for handles with multiple connections and for partial removals
  - Handle measurement no longer races the node ref on initial mount (edges failing to appear on first paint)
  - Prop defaulting no longer lets explicitly-forwarded `undefined` props clobber child defaults (mispositioned handles)
  - DOM listeners wired through `@solid-primitives/event-listener`; media queries through `@solid-primitives/media`

  Public API (props, components, hooks), the SSR contract, and the `solid` export condition are unchanged.

## 0.2.3

### Patch Changes

- 4bcb530: Migrate the build pipeline from tsup to tsdown (Rolldown). The published artifacts keep the same shape and paths — Solid-compiled ESM, a JSX-preserved `.jsx` entry for the `solid` export condition, type declarations, and the stylesheet — with `console.*`/`debugger` still stripped from production builds. `babel-preset-solid` is pinned to 1.9.6 so the compiled output stays compatible with the full `solid-js >=1.8.0` peer range.
- 89ef9f6: Fix server-side rendering: `<SolidFlow>` can now be rendered with `renderToString` (e.g. in SolidStart) without crashing. The node `ResizeObserver` was constructed during render (it is now browser-only), and the selection auto-pan cleanup called `cancelAnimationFrame` on disposal even on the server. Nodes that declare `width`/`height` render server-side with correct positions and visibility, and `fitView` with explicit flow `width`/`height` props is computed on the server — matching React Flow 12's SSR contract.

## 0.2.2

### Patch Changes

- 6c58745: Fix Safari compatibility: `requestIdleCallback` is not available in Safari, which broke node measurement. Internal scheduling now falls back to a macrotask where the API is missing. (#19)

## 0.2.1

### Patch Changes

- Add explicit return types to all public API functions (components and hooks). No runtime changes. This satisfies JSR's no-slow-types check — enabling `.d.ts` generation and faster type-checking for JSR consumers — and ships slightly leaner declaration files on npm.

## 0.2.0

### Minor Changes

- 4200a47: Close the feature drift against Svelte Flow 1.6.3:

  - **`zIndexMode` prop** (`'auto' | 'basic' | 'manual'`): controls automatic z-indexing. `'auto'` also manages stacking for sub flows via root-parent z increments, `'basic'` (default) elevates selections only, and `'manual'` disables automatic z-indexing entirely.
  - **`autoPanOnSelection` prop**: the viewport now auto-pans when a drag selection approaches the edges of the container (enabled by default). The selection rectangle origin is anchored in flow space so it stays fixed on the canvas while panning.
  - **`onSelectionChange` prop is now wired** — it previously existed in the types but never fired. It is called with `{ nodes, edges }` whenever the set of selected elements changes.
  - **`<EdgeToolbar />` component**: renders a toolbar/tooltip for an edge inside a custom edge component, visible when the edge is selected (or controlled via `isVisible`).
  - **New hooks**: `useNodesInitialized()`, `useViewportInitialized()`, and `useColorMode()` expose reactive access to node measurement state, pan/zoom readiness, and the resolved color mode.
  - Drag selection now respects `paneClickDistance` before starting, handles `pointercancel`, and supports starting a selection on top of nodes while the selection key is held.
  - `defaultMarkerColor` accepts `null` to defer to the `--xy-edge-stroke` CSS variable.
  - `isValidConnection` is now generic over your edge type.
  - Removed the dead legacy `EdgeUpdateAnchors` component (superseded by `EdgeReconnectAnchor`).

### Patch Changes

- 63a966a: Update `@xyflow/system` from 0.0.68 to 0.0.80, pulling in 12 patch releases of upstream fixes (pan/zoom filter improvements, `fitView` fixes for hidden and unmeasured nodes, `getNodesBounds` no longer stretching to the origin for unresolvable nodes, `extent: 'parent'` resolution, dark-mode background pattern color, and more).

  Port the matching integration changes from Svelte Flow 1.6.3:

  - Thread `panActivationKeyPressed` into the pan/zoom filter so a Control-key pan activation allows primary-button dragging.
  - Prefer touch panning over drag selection when `selectionOnDrag` is combined with mouse-button-specific `panOnDrag` settings.
  - Thread `panOnScrollSpeed`, `selectionOnDrag`, `paneClickDistance`, and `connectionInProgress` through to the pan/zoom instance.

  Fix a race where the initial `fitView` could run before the flow container was measured, producing a zero/invalid viewport (blank canvas). The initial fit now waits for both measured nodes and container dimensions, whichever arrives last.

## 0.1.4

### Patch Changes

- disable bundler minification

## 0.1.3

### Patch Changes

- updates css export path

## 0.1.2

### Patch Changes

- update package keywords

## 0.1.1

### Patch Changes

- Fix repository link

## 0.1.0

### Major Changes

- **🎉 Initial Alpha Release**: First public release of Solid Flow - a highly customizable SolidJS library for building node-based editors, workflow systems, and interactive diagrams

### ✨ Core Features

#### **Main Components**

- **`SolidFlow`**: Main flow component with comprehensive props and event handling
- **`SolidFlowProvider`**: Context provider for multi-flow scenarios and advanced state management

#### **Built-in Node Types**

- **`InputNode`**: Nodes with source handles only (workflow starting points)
- **`OutputNode`**: Nodes with target handles only (workflow ending points)
- **`DefaultNode`**: Standard nodes with both source and target handles
- **`GroupNode`**: Container nodes for organizing and grouping other nodes

#### **Built-in Edge Types**

- **`BezierEdge`**: Smooth curved connections (default styling)
- **`StraightEdge`**: Direct straight-line connections
- **`StepEdge`**: Right-angle step-style connections
- **`SmoothStepEdge`**: Rounded step connections with smooth corners

#### **Plugin Components**

- **`Background`**: Customizable canvas backgrounds with multiple pattern variants:
  - Dots pattern with configurable size and spacing
  - Lines pattern for grid-style backgrounds
  - Cross pattern for intersection guides
  - Support for multiple background layers
- **`Controls`**: Interactive zoom and viewport controls:
  - Zoom in/out buttons
  - Fit view to show all nodes
  - Lock/unlock interaction toggle
  - Horizontal and vertical orientations
  - Custom control button support
- **`MiniMap`**: Interactive overview component:
  - Real-time viewport indicator
  - Clickable navigation
  - Customizable node colors and styling
  - Configurable size and positioning
- **`NodeToolbar`**: Context-sensitive toolbars for nodes:
  - Multiple positioning options (top, bottom, left, right)
  - Alignment controls (start, center, end)
  - Custom toolbar content support
  - Selection-based visibility
- **`NodeResizer`**: Real-time node resizing capabilities:
  - Multiple resize handle positions
  - Custom resize controls and constraints
  - Aspect ratio maintenance
  - Minimum/maximum size limits

### 🎣 **Reactive State Management**

#### **Store-Based Architecture**

- **`createNodeStore()`**: Type-safe reactive store for nodes with full TypeScript support
- **`createEdgeStore()`**: Type-safe reactive store for edges with custom type integration
- **`createSolidFlow()`**: Core flow state management with SolidJS reactivity

#### **Essential Hooks**

- **`useSolidFlow()`**: Main flow instance hook with comprehensive API:
  - `addNodes()`, `updateNode()`, `deleteElements()` for programmatic control
  - `screenToFlowPosition()`, `flowToScreenPosition()` for coordinate transformations
  - `fitView()`, `zoomIn()`, `zoomOut()` for viewport management
- **`useConnection()`**: Real-time connection state during drag operations
- **`useNodesData()`**: Reactive access to specific node data with automatic updates
- **`useNodeConnections()`**: Get connection information for specific nodes
- **`useUpdateNodeInternals()`**: Force node internal updates for custom components

### 🎨 **Customization & Extensibility**

#### **Custom Components**

- Full TypeScript support for custom node and edge components
- `NodeProps<TData, TType>` and `EdgeProps<TData, TType>` for type-safe component creation
- Multiple handle support with custom positioning and styling
- Custom drag handles with selector-based configuration

#### **Type Safety**

- Generic type parameters for nodes and edges throughout the API
- `satisfies NodeTypes` and `satisfies EdgeTypes` patterns for type inference
- Automatic data validation based on node/edge types
- IntelliSense support for custom component properties

#### **Styling & Theming**

- CSS custom properties support for theme customization
- Light/dark/system color modes with SSR support
- Comprehensive CSS class system for styling overrides
- Color mode transitions and user preference detection

### 🎯 **Interaction & Navigation**

#### **Viewport Controls**

- Smooth pan and zoom with mouse, touch, and keyboard support
- Configurable zoom limits and pan boundaries
- Snap-to-grid functionality with customizable grid sizes
- Fit view with padding and specific node targeting

#### **Selection System**

- Single and multi-node/edge selection
- Selection box (drag-to-select multiple items)
- Keyboard shortcuts (Ctrl/Cmd+click, Shift+click)
- Programmatic selection control with event callbacks

#### **Drag & Drop**

- Built-in node dragging with multi-selection support
- External drag-and-drop for adding new elements
- Custom drag handles for specialized interactions
- Auto-panning during drag operations
- Drag threshold configuration

### ♿ **Accessibility Features**

#### **Keyboard Navigation**

- Full tab navigation between focusable elements
- Arrow key navigation for selected nodes
- Enter/Space key activation for selection
- Delete key for removing selected elements
- Customizable keyboard shortcuts and key bindings

#### **Screen Reader Support**

- ARIA labels and descriptions for all interactive elements
- `A11yDescriptions` component for enhanced screen reader context
- Semantic HTML structure throughout components
- Focus management and visual indicators
- High contrast mode compatibility

### ⚡ **Performance & Optimization**

#### **Rendering Performance**

- Fine-grained reactivity using SolidJS's reactive primitives
- Only re-renders components when their specific data changes
- Efficient viewport calculations and coordinate transformations
- Memory-optimized node and edge storage

#### **Large Dataset Handling**

- Stress-tested with hundreds of nodes and edges
- Optimized selection algorithms for large graphs
- Efficient intersection detection and bounds calculations
- `onlyRenderVisibleElements` prop (planned - currently no-op for performance reasons)

### 🔧 **Developer Experience**

#### **Comprehensive Examples**

- **25+ Interactive Examples** in the included playground:
  - Basic usage and getting started
  - Custom nodes and edges with multiple handles
  - Drag and drop from external elements
  - Connection validation and rules
  - Accessibility and keyboard navigation
  - Performance testing with large datasets
  - Subflows and hierarchical organization
  - Edge types and styling variations
  - Node toolbar and resizer implementations

#### **TypeScript Integration**

- Full TypeScript support with strict type checking
- Generic type parameters throughout the API
- IntelliSense support for all components and hooks
- Type-safe custom component creation
- Automatic type inference for node and edge data

#### **Development Tools**

- Comprehensive error handling with development warnings
- Performance monitoring and debugging utilities
- Hot reload support during development
- Source map support for debugging

### 🔗 **Connection System**

#### **Connection Handling**

- Drag-to-connect interface with visual feedback
- Click-to-connect alternative interaction mode
- Connection validation with `isValidConnection` callback
- Custom connection line components with full styling control
- Auto-panning during connection creation

#### **Handle System**

- Multiple handles per node (source and target)
- Custom handle positioning with `Position` enum
- Handle-specific connection rules and validation
- Visual feedback during connection attempts
- Custom handle styling and behavior

### 📊 **Utility Functions**

#### **Coordinate Transformations**

- `screenToFlowPosition()`: Convert screen coordinates to flow coordinates
- `flowToScreenPosition()`: Convert flow coordinates to screen coordinates
- Automatic viewport transformation handling

#### **Graph Utilities**

- `getNodesBounds()`: Calculate bounding box for node collections
- `getIntersectingNodes()`: Find nodes that intersect with a given node
- `getConnectedEdges()`: Get all edges connected to specific nodes
- `getIncomers()` and `getOutgoers()`: Get connected nodes in specific directions

#### **Edge Utilities**

- `addEdge()`: Add new edges to existing collections
- `getBezierPath()`, `getStraightPath()`, `getSmoothStepPath()`: Path calculation utilities
- `getEdgeCenter()`: Calculate center points for edge labeling

### 🏗️ **Architecture & Patterns**

#### **Store-First Design**

- Built around SolidJS's reactive store system rather than signals
- Immutable updates using `produce()` from solid-js/store
- Automatic subscription to store changes throughout the component tree

#### **Event System**

- Comprehensive event handling for all user interactions:
  - Node events: click, drag, hover, focus, context menu
  - Edge events: click, hover, focus, context menu
  - Pane events: click, context menu, viewport changes
  - Selection events: selection start, change, and end
  - Connection events: connection start, connect, and end

#### **Plugin Architecture**

- Modular plugin components that integrate seamlessly
- Consistent API patterns across all plugin components
- Easy integration of custom plugins following established patterns

### 🔄 **Compatibility & Integration**

#### **SolidJS Integration**

- Built specifically for SolidJS 1.8.0+
- Leverages SolidJS's fine-grained reactivity system
- Compatible with SolidJS ecosystem tools and patterns
- SSR support for server-side rendering scenarios

#### **External Dependencies**

- `@xyflow/system`: Core flow logic and utilities (v0.0.68)
- `@solid-primitives/*`: SolidJS primitive utilities for enhanced functionality
- `clsx`: Utility for conditional CSS class names
- Minimal dependency footprint for bundle size optimization

### 📦 **Package & Distribution**

#### **Multiple Export Formats**

- ESM modules with tree-shaking support
- TypeScript declaration files included
- Separate styles export for CSS customization
- Optimized bundle sizes for production use

#### **Development Setup**

- Comprehensive development playground with live examples
- Vite-based development server with HMR
- TypeScript strict mode for development
- ESLint and Prettier configuration included
- Vitest for comprehensive testing

### 🚧 **Known Limitations (Alpha Release)**

- `onlyRenderVisibleElements` prop currently no-op (performance optimization needed)
- Custom MiniMap nodes not yet supported
- Edge reconnect anchors not implemented
- Some advanced React Flow features still in development

### 📋 **Migration Notes**

This is the first release, so no migration is needed. However, developers familiar with React Flow or Svelte Flow should note:

- Uses **stores instead of signals** for state management
- Connection handling uses `onConnect` with store updates rather than state setters
- TypeScript patterns follow SolidJS conventions
- Event handlers receive SolidJS-specific event objects

---

**Full Changelog**: https://github.com/dsnchz/solid-flow/releases/tag/v0.1.0
