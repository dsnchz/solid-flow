# Architecture

How Solid Flow 1.x is put together, for contributors. The README covers the
user-facing contracts; this document covers the design underneath them and the
reasons the subtle parts look the way they do.

## Layers

```
@xyflow/system          gestures, geometry, d3 pan/zoom — framework-agnostic
      ▲
src/core/               the HEADLESS data graph (no DOM, no components)
      ▲
src/browser/            DOM wiring: measurement, resize/media observers
      ▲
src/components/         render layer (SolidFlow, renderers, wrappers, Handle)
src/plugins/ src/hooks/ Background, MiniMap, Controls, …  +  the hook surface
```

`core/` is constructable and fully testable without a DOM (`createFlowState`).
`browser/createSolidFlow` composes it with the DOM seams — measurement ingest,
media queries, the built-in renderer maps — via the `FlowStateInjections`
parameter. Anything that can live in `core/` should: headless code is testable
in plain node and reviewable without component context.

## The data graph (`src/core/`)

`createFlowState.ts` is the **composition root**: it declares the writable
roots, wires the projections, assembles the public structs, and delegates all
behavior to focused modules:

- **Writable roots.** The user graph (`stores/seeding.ts` — see Ownership
  below) and a separate **measurements root** (DOM-derived dimensions and
  handle bounds). Two roots by design: a controlled nodes-array reset must not
  wipe measurements.
- **Sidecar overlays.** `selectionOverlay.ts` and `dragOverlay.ts` — flow-owned
  keyed records for flow-driven state (see The sidecar composition).
- **Projections** (`projections/`). Pure derivations over the roots:
  `internalNodes` (the joined per-node record the renderers read),
  `layoutedEdges` (edge geometry join), `edgeLookup`, `connections`,
  `selectedIds`, `parentIds`. Derived stores have no write side and no GC —
  that's the point.
- **Command groups** (`commands/`). `viewport.ts` (camera + coordinate
  conversion), `elements.ts` (structural/field mutations + the gesture-driven
  writers), `geometry.ts` (intersection queries over a microtask-cached
  spatial grid), `selection.ts` (everything that mutates `selected`). Each
  takes a narrow deps object — a typed slice of the store plus the setters it
  needs — so it stays headless-testable and its blast radius is visible in its
  signature.
- **`overlayRelease.ts`.** The confirm-then-release lifecycle for the sidecars
  (see below).
- **Facades.** `RecordMapFacade` adapts a keyed record to the `Map` interface
  @xyflow/system expects. Its `get` probes the value before the `in` check:
  an `in`-first probe subscribes at ownKeys level, i.e. record-WIDE.

The public read surface is the reactive `flow` struct (stable identity,
reactivity inside the property getters); the write surface is the `commands`
struct. Hooks are aliases over these — implementations live in core.

## Ownership and seeding (`stores/seeding.ts`)

Controlled vs uncontrolled is decided **per axis** by which prop you pass
(`nodes` vs `defaultNodes`), observable internally as
`config().nodes !== undefined`:

- **Controlled**: the internal store is created _from the user's store proxy_,
  so flow-side writes pierce into it (that is the parity contract — "reading
  your store is live"). The user's writes are authoritative: a wholesale
  replacement re-seeds from exactly their array. **Completed connections never
  write membership on a controlled axis** — `addEdge` (the
  connection-completion writer) is a no-op there; the connection reaches the
  user only through `onConnect`, and adoption is what makes it exist.
  Auto-inserting would duplicate the documented adoption push.
- **Uncontrolled**: defaults seed once (including from a _pending_ async
  store, via an `isPending` probe plus a one-shot adoption effect), then the
  flow owns membership. Rows are shallow-copied at seed: the flow owns its
  draft, so no flow write may land on the caller's objects (which may be
  another store's row proxies in the draft-then-commit pattern).
- **`updateNode` / `updateEdge` merge by writing fields into the draft row**,
  never by replacing the array slot. A replaced slot reads as a membership
  change to everything keyed on row identity (id lists, lookups, per-row
  mapArray rows) and re-derived the whole graph for one `updateNodeData`.
  `replace: true` is the only slot write.

The stores are plain writable stores, **not** the projection form of
`createStore`: deriving from a store-proxy source rewraps every element on
structural writes, churning all row identities.

## The sidecar composition (solid#3085)

The reason optimistic stores (`createOptimisticStore`) work as `nodes`/`edges`
with zero store-kind detection: flow-driven state does not _depend_ on landing
in the user's rows.

- **Render membership from the user's store** (`visibleNodeIds` maps the
  seeded store, not a projection): a derived record's enumeration does not
  surface an optimistic membership edit mid-action, while direct row reads
  pierce the overlay.
- **Flow ephemera live in flow-owned keyed sidecars**, joined with the user's
  rows at read time: selection booleans in `selectionOverlay`, drag positions
  in `dragOverlay`, measurements in the measurements root (measurement-first
  join). The row write-through still happens (parity), but rendering never
  requires it to stick — on an optimistic store it reverts with the overlay,
  and the join keeps governing.
- **Entries hold the row PROXY captured at write time.** Reads through a
  captured proxy pierce; pulling a derived keyed record inside a write flush
  triggers an O(sources) marking wave (~130ms @10k measured). The release
  path never touches the lookups during flush; gone-row sweeping happens in a
  deferred timer.
- **Confirm-then-release** (`overlayRelease.ts`): an entry is deleted once the
  row _stably_ carries the written value, re-verified on a macrotask —
  an optimistic write is briefly visible to effects before its transaction
  reverts it, so only a post-settle re-check distinguishes "landed" from
  "reverted". Lifetime, not value, is what disambiguates: for booleans, a
  user toggling back is value-identical to a revert.

## The SolidJS 2.0 async rules

Three rules keep the graph correct under 2.0's async model:

- **Never swallow `NotReadyError`.** A broad `try/catch` around store reads in
  a computation breaks the server build: propagation is the re-derive channel
  (solid#3073). Branch on readiness with `isPending()` instead.
- **Component setup is untracked.** Reading a pending async source there is a
  hard error — probe with `isPending` (all access inside the accessor) and
  defer the read to a tracked scope (see the seeding adoption effects).
- **`flush()` is a gesture-boundary tool, never a command's.** The engine
  refuses a flush inside an action body (`FLUSH_IN_ACTION`: an action's
  writes are held by its transaction, so a flush there cannot reveal them and
  would detach the writes that follow). Users may call any `FlowCommands`
  member synchronously inside `action(function* …)`, so nothing on that
  surface may flush — directly or transitively. Our flushes live only where
  @xyflow/system reads state back synchronously through `nodeLookup` in the
  same DOM event: the selection `actions` behind node/edge mousedown, Pane's
  box-selection handlers, connection start, and the scheduled measurement
  ingest. Promoting an internal action to `FlowCommands` means moving its
  flush out to the gesture call site first.

Async seeds and async generators need no special machinery: `createStore`
accepts them natively, so `createNodeStore(async () => …)` and live streams
are the same code path as arrays.

## Rendering and performance

- Renderers iterate stable id lists (`visibleNodeIds`/`visibleEdgeIds`) and
  guard per row against not-yet-materialized projection rows. Membership
  changes never rebuild the list pipeline.
- **Two culling tiers**: an always-on CSS tier (visibility/pointer-events on
  off-viewport elements; no userland contract) and the opt-in
  `onlyRenderVisibleElements` unmount tier (per-row `Show` gates inside the
  renderer `For`, so the id list stays stable).
- **Gesture-scoped spatial lookups**: connection drags and box selection
  answer closest-handle/containment queries from a spatial grid snapshotted
  at gesture start (geometry is frozen mid-gesture) instead of upstream's
  full scans. `getIntersectingNodes` shares a microtask-lifetime grid.
- Avoid monolithic view memos: a memo that maps every row rebuilds all its
  subscriptions on any recompute. Prefer keyed projections
  (`projections/presenceIds.ts` is the template — one tiny projection per row
  deciding its own presence, O(changed-row); `selectedIds` and the unmeasured
  set behind `nodesInitialized` use it; `connections` and the marker index use
  per-row memos merged by a record projection).
- **No memo-backed prop sources on per-row paths.** `merge()` wraps a
  function source in a memo, and the compiler emits exactly that for a JSX
  spread with a dynamic expression (`{...node().domAttributes}` becomes
  `merge({…bindings}, () => …)`). Every binding on that element then reads
  through the memo, and each read marks the whole dirty heap while thousands
  of rows are mounting — ~3s of a 12s 10k mount (profile, bench round 17).
  Per-row components apply dynamic attribute bags with a direct
  `spread(el, () => attrs, true)` from the ref, and the internal `store`
  reads config through plain getters (`propGetters`), never a memo source.
- **No effects over a row's own ref signal.** An effect whose source is
  written while the row mounts (`createEffect(() => nodeRef(), …)` with
  `ref={setNodeRef}`) is dirty for the rest of the synchronous mount and sits
  in the engine's pure heap; every later row's first memo pull re-marks that
  whole heap (`markHeap`), which made a 10k mount O(N²) — 9.6s → 4.3s once
  removed (bench rounds 17–18, standalone repro in
  `.agent/spikes/p34-markheap-mount`; upstream solidjs/solid#3350). Per-row components wire their element
  from the ref callback, owner-bound: `runWithOwner(owner, () =>
mountElement(el))`, with `el` captured as a plain value and the effects
  inside depending on node fields and props only.
- **Keyed records hold frozen holders, never row proxies.** A projection
  slot assigned a store proxy is unwrapped on write and re-wrapped on read
  under the RECORD's projection family, so every nested leaf a consumer
  reads through `internalNodes[id]` (`measured.width`,
  `internals.positionAbsolute`, …) becomes a signal owned by the long-lived
  record instead of the row — and the engine never unlinks a projection's
  leaf signals when a key is deleted, so deleted rows stayed reachable (with
  their last values) for the flow's lifetime: ~26 KB per deleted node+edge
  pair, 260 MB after delete-all @10k (bench round 20, headless repro in
  `.agent/spikes/p35-retained-after-delete`; upstream solidjs/solid#3351).
  `createRowRecordProjection`
  stores one `Object.freeze({ get row() })` holder per row store (frozen
  objects are not wrappable — served raw) behind `createRecordFacade`, so
  `record[id]` IS the row store's own proxy and nested leaves die with the
  row. `edgeLookup` is the same helper over a keyed `mapArray`. Retained
  after delete-all @10k: 260 → 37 MB (the example's own arrays); mounted
  heap −13% (one signal per leaf instead of two).
- **The state never holds DOM past the canvas.** `SolidFlowProvider` hoists
  the state above `SolidFlow`, so the canvas can unmount while the state
  lives on; `domNode` alone pinned the whole detached subtree and every
  delegated handler on it (~490 MB after unmount @10k). The canvas clears
  `domNode` in its cleanup and `Zoom` destroys the pan/zoom controller and
  clears `panZoom` with the pane (`unmountRelease.test.tsx`). A hoisted
  state keeps its DATA by contract (~320 MB @10k); a flow under its own
  provider releases everything (24 MB, the example's arrays).
- **Per-row render costs (bench round 21).** Three rules for the wrappers
  and anything rendered once per node/edge/handle: (1) resolve the row ONCE
  (`const node = createMemo(() => nodeLookup.get(id))`) — every binding
  reads it, and each resolution through the record is two store-slot reads
  (holder slot, row slot), or a record-wide `in` probe for edges; (2) render
  the user component through `dynamic(() => component())` from
  `@solidjs/web`, not `<Dynamic>` — `<Dynamic>` re-copies every prop
  descriptor per row (`omit(props, "component")`); (3) assign `class` as one
  string via `cx(...)` (`utils.ts`), never the array/object form — `@solidjs/web`
  flattens and diffs a key map on every assignment. Together: 10k mount
  3.25 s → 2.6 s, selection drag 0.6 → 0.35 ms/move. What remains in the
  mount profile is engine store reads, DOM creation, GC and the row derive;
  Handle's per-instance `propDefaults`/`omit`/`merge` (~100 ms @10k) is the
  one library-side item left.
- **Gesture-scoped lookups for @xyflow/system.** System helpers that take a
  `Map` and SCAN it (XYDrag's `getDragItems` at drag start) get a
  `SubsetMapView` (`core/subsetMapView.ts`): iteration yields only the
  candidates the helper will pick anyway (selected ids + the dragged id from
  the keyed `selectedNodeIds` record), keyed `get`/`has` resolve any node
  through the full facade. First drag frame @10k 19 → 2 ms (bench round 22).
  Prefer this over a bespoke drag path: XYDrag's semantics stay upstream's.
- **Geometry is reported once, by the row derive.** `internalNodes`'s row
  derive calls `onGeometryChange(id, rect | null)` with the node's absolute
  rect (plus `parentId`) whenever it changes; the state keeps a plain
  `nodeGeometry: ReadonlyMap` from it (and bumps `geometryVersion`). Anything
  that needs EVERY node's rect at a gesture start reads that map — the
  connection arm (`GestureSpatialLookup.armFrom`), box selection, the
  minimap's bounds partition (`core/graphBounds.ts`), the intersection
  commands' per-task grid (`commands/geometry.ts`) — never the row proxies
  (~2.5 µs per row through the store traps; 25-40 ms per start @10k, bench
  round 23). The one remaining gesture-start cost is the browser's style
  recalc when the root connection classes flip (~25-40 ms @10k: every handle
  matches the affordance selectors) — by design, one recalc per gesture
  instead of a class write per handle.
- **Big keyed projections: draft form, and never touch the root per gesture.**
  A projection that RETURNS a fresh record makes the engine reconcile it
  against the store (`reconcileNextState`/`applyAdopt`) and clone the raw;
  a draft-form derive that writes only the changed keys avoids that. But the
  engine also clones a projection target's raw on the FIRST write to it in a
  derive (`ensurePB` → `cloneRaw`; the cheap prototype overlay is reserved
  for plain stores), so a root-level set/delete on a 20k-key record costs
  ~13 ms @10k regardless. `connections` therefore keeps root keys stable on
  a reconnect (an emptied handle sub-record stays `{}`) and prunes empties
  only when a never-seen key forces a root write anyway. Reconnect 34 → 21 ms
  (bench round 24).
- **Culling is a keyed record, not a per-row read of the viewport.** The
  quantized culling viewport steps every quarter-viewport of pan; a per-row
  memo over it makes every step re-run all ~20k row memos through the store
  proxies (50–66 ms frames @10k, bench round 26). `onScreenNodeIds` /
  `onScreenEdgeIds` (`projections/onScreenIds.ts`) compute overlap once per
  step over the plain geometry maps (a full pass, ~1 ms) and only for the
  reported ids on a geometry change (`geometryFeed.ts`: rows report rects,
  the feed bumps one `ownedWrite` tick per batch so the record settles in
  the same flush), writing only the keys that flip. Rows read `id in
record` — the engine subscribes per key, including absent keys — through
  `nodeCulled` / `edgeCulled`, which keep the never-cull guards, and read the
  equality-cut `store.cullingActive` instead of the viewport.
- **Never change an inherited CSS property on an ancestor of the graph.**
  `cursor: grabbing` on the pane at drag start cost one ~70 ms style recalc
  of all 460k descendants @10k (measured: 69 ms per flip; an unrelated class
  or a non-inherited property 0 ms). The pan cursor is a leaf cover
  (`.solid-flow__pan-cursor`, rendered by `Zoom` from the first pan MOVE —
  never on start, a click also starts a d3-zoom gesture and a cover under
  the mouseup swallows it — until the gesture ends); `.dragging` on the pane
  keeps its name (parity) but no cursor rule. `selection` keeps its cursor:
  it can be on at rest, and a cover would intercept clicks.
- **Reactive nodes are named** (`{ name }` on memos, effects, projections) so
  the rc.7 dev diagnostics (`HUGE_FAN_IN`, `HUGE_FAN_OUT`, `WIDE_SCOPE_DEPS`)
  and `DEV.attribution.costs()` identify them. The stress example enables
  attribution with `?attr=1`; `e2e/attribution-probe.spec.ts` prints the
  warnings and cost tables. Diagnostics that fire BY DESIGN on a large graph,
  and must not be "fixed": `visibleNodeIds`/`visibleEdgeIds` (membership id
  lists read one id per row — inherent, membership cadence only), the
  renderers' `<For>` insert effects (framework: one child value per row), and
  `connectionFromHandle` / `cullingViewport` fan-out (every row subscribes on
  purpose — each changes once per gesture or pan frame and costs O(1) per
  subscriber). Anything else the diagnostics name is a finding.

- **Update budgets in CI** (`src/__tests__/diagnosticsBudget.test.ts`, via
  `@solidjs/diagnostics`): a 400-node headless flow, one gesture write per
  scenario (drag frame, select, reconnect), asserting how many scopes re-ran
  (measured values with headroom: 2 / 6 / 3 at the time of writing) and that
  the only diagnostics are the by-design ones (`WIDE_SCOPE_DEPS` on the
  `selectedIds` and `connections` record merges). The timing benches measure
  milliseconds; this pins the granularity they come from. `expectNoWaste` is
  not usable: draft-form projections return no value, so every per-row derive
  reads as an unchanged recompute.

## Typing

- **Guided unions**: `createNodeStore<typeof nodeTypes>` narrows each row's
  `data` by its `type` discriminant against the renderer map; `SolidFlowNode`
  / `SolidFlowEdge` export the same unions standalone. The optimistic
  factories mirror the full core surface via overloads.
- **Enum mirrors** (`types/general.ts`): each @xyflow/system enum is exposed
  as a value + string-union type pair. The _value_ stays the upstream enum
  object — the only thing assignable into system-typed fields like
  `NodeBase.sourcePosition` — while the _type_ is the union so literals are
  first-class everywhere Solid Flow owns the type. Pinned by
  `enumMirrors.test.ts`.
- The generic-context cast lives in exactly one place
  (`contexts/flow.ts#typedSolidFlowContext`).

## Testing

Three lanes (`bun run test`, `test:ssr`, `test:e2e`): jsdom unit/component
tests co-located in `__tests__/` folders, an SSR lane running the server
build, and a Playwright gesture harness (`e2e/`) against the playground.
Conventions: failing test first; no vacuous assertions; anything extractable
to `core/` gets headless tests; gesture tests share
`components/__tests__/gestureHarness.ts`.
