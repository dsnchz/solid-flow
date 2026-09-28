# Architecture

How Solid Flow 1.x is put together, for contributors. The README covers the user-facing contracts; this document covers the design underneath them and the reasons the subtle parts look the way they do.

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

`core/` is constructable and fully testable without a DOM (`createFlowState`). `browser/createSolidFlow` composes it with the DOM seams — measurement ingest, media queries, the built-in renderer maps — via the `FlowStateInjections` parameter. Anything that can live in `core/` should: headless code is testable in plain node and reviewable without component context.

## The data graph (`src/core/`)

`createFlowState.ts` is the **composition root**: it declares the writable roots, wires the projections, assembles the public structs, and delegates all behavior to focused modules:

- **Writable roots.** The user graph (`stores/seeding.ts` — see Ownership below) and a separate **measurements root** (DOM-derived dimensions and handle bounds). Two roots by design: a controlled nodes-array reset must not wipe measurements.
- **Sidecar overlays.** `selectionOverlay.ts` and `dragOverlay.ts` — flow-owned keyed records for flow-driven state (see The sidecar composition).
- **Projections** (`projections/`). Pure derivations over the roots: `internalNodes` (the joined per-node record the renderers read), `layoutedEdges` (edge geometry join), `edgeLookup`, `connections`, `markers`, `parentIds`, the keyed presence records built on `presenceIds` (`selectedIds`, the unmeasured set behind `nodesInitialized`), the on-screen membership (`onScreenIds`, a set plus per-row signals) and the selection box bounds (`selectedBounds`). Derived stores have no write side and no GC — that's the point.
- **Command groups** (`commands/`). `viewport.ts` (camera + coordinate conversion), `elements.ts` (structural/field mutations + the gesture-driven writers), `geometry.ts` (intersection queries over a microtask-cached spatial grid), `selection.ts` (everything that mutates `selected`). Each takes a narrow deps object — a typed slice of the store plus the setters it needs — so it stays headless-testable and its blast radius is visible in its signature.
- **`overlayRelease.ts`.** The confirm-then-release lifecycle for the sidecars (see below).
- **Facades.** `RecordMapFacade` adapts a keyed record to the `Map` interface @xyflow/system expects. Its `get` probes the value before the `in` check: an `in`-first probe subscribes at ownKeys level, i.e. record-WIDE.

The public read surface is the reactive `flow` struct (stable identity, reactivity inside the property getters); the write surface is the `commands` struct. Hooks are aliases over these — implementations live in core.

## Ownership and seeding (`stores/seeding.ts`)

Controlled vs uncontrolled is decided **per axis** by which prop you pass (`nodes` vs `defaultNodes`), observable internally as `config().nodes !== undefined`:

- **Controlled**: the internal store is created _from the user's store proxy_, so flow-side writes pierce into it (that is the parity contract — "reading your store is live"). The user's writes are authoritative: a wholesale replacement re-seeds from exactly their array. **Completed connections never write membership on a controlled axis** — `addEdge` (the connection-completion writer) is a no-op there; the connection reaches the user only through `onConnect`, and adoption is what makes it exist. Auto-inserting would duplicate the documented adoption push.
- **Uncontrolled**: defaults seed once (including from a _pending_ async store, via an `isPending` probe plus a one-shot adoption effect), then the flow owns membership. Rows are shallow-copied at seed: the flow owns its draft, so no flow write may land on the caller's objects (which may be another store's row proxies in the draft-then-commit pattern). Every adopted row — the uncontrolled copy, rows from the node store factories, `addNodes` — is seeded with the flow-owned keys while still plain (`core/nodeSeed.ts`): `measured: {}`, `selected: false`, `dragging: false`. A supplied value is kept; a raw user store is left alone until the flow first writes the key.
- **`updateNode` / `updateEdge` merge by writing fields into the draft row**, never by replacing the array slot. A replaced slot reads as a membership change to everything keyed on row identity (id lists, lookups, per-row mapArray rows) and re-derived the whole graph for one `updateNodeData`. `replace: true` is the only slot write.

The stores are plain writable stores, **not** the projection form of `createStore`: deriving from a store-proxy source rewraps every element on structural writes, churning all row identities.

## The sidecar composition (solid#3085)

The reason optimistic stores (`createOptimisticStore`) work as `nodes`/`edges` with zero store-kind detection: flow-driven state does not _depend_ on landing in the user's rows.

- **Render membership from the user's store** (`visibleNodeIds` maps the seeded store, not a projection): a derived record's enumeration does not surface an optimistic membership edit mid-action, while direct row reads pierce the overlay.
- **Flow ephemera live in flow-owned keyed sidecars**, joined with the user's rows at read time: selection booleans in `selectionOverlay`, drag positions in `dragOverlay`, measurements in the measurements root (measurement-first join). The row write-through still happens (parity), but rendering never requires it to stick — on an optimistic store it reverts with the overlay, and the join keeps governing.
- **Entries hold the row PROXY captured at write time.** Reads through a captured proxy pierce; pulling a derived keyed record inside a write flush triggers an O(sources) marking wave (~130ms @10k measured). The release path never touches the lookups during flush; gone-row sweeping happens in a deferred timer.
- **Confirm-then-release** (`overlayRelease.ts`): an entry is deleted once the row _stably_ carries the written value, re-verified on a macrotask — an optimistic write is briefly visible to effects before its transaction reverts it, so only a post-settle re-check distinguishes "landed" from "reverted". Lifetime, not value, is what disambiguates: for booleans, a user toggling back is value-identical to a revert.

## The SolidJS 2.0 async rules

Four rules keep the graph correct under 2.0's async model:

- **Never swallow `NotReadyError`.** A broad `try/catch` around store reads in a computation breaks the server build: propagation is the re-derive channel (solid#3073). Branch on readiness with `isPending()` instead.
- **Component setup is untracked.** Reading a pending async source there is a hard error — probe with `isPending` (all access inside the accessor) and defer the read to a tracked scope (see the seeding adoption effects).
- **`flush()` is a gesture-boundary tool, never a command's.** The engine refuses a flush inside an action body (`FLUSH_IN_ACTION`: an action's writes are held by its transaction, so a flush there cannot reveal them and would detach the writes that follow). Users may call any `FlowCommands` member synchronously inside `action(function* …)`, so nothing on that surface may flush — directly or transitively. Our flushes live only where @xyflow/system reads state back synchronously through `nodeLookup` in the same DOM event: the selection `actions` behind node/edge mousedown, Pane's box-selection handlers, connection start, and the scheduled measurement ingest. Promoting an internal action to `FlowCommands` means moving its flush out to the gesture call site first.
- **Scheduled callbacks have no owner.** A timer, idle, animation-frame or microtask callback runs outside every tracking scope, so a graph read in one that meets a still-pending async source throws `NotReadyError` with nothing to catch it: an uncaught error in the browser. Any callback that can fire before the first data lands (the idle selection-view prime at construction was the one case) must probe through `isPending`, which does the reads when the graph is ready and stays quiet otherwise. Callbacks that only follow a gesture or a measurement are safe by construction: a revalidating store keeps serving its last value after the first one. Pinned by `src/browser/__tests__/asyncSeedIdle.test.tsx` (fake timers, so a throwing callback fails inside the test instead of escaping the run).

Async seeds and async generators need no special machinery: `createStore` accepts them natively, so `createNodeStore(async () => …)` and live streams are the same code path as arrays.

## Rendering and performance

### The trade, stated once

Solid Flow treats the graph somewhat like a database using incremental view maintenance. Like the other xyflow implementations, it eagerly builds the fundamental graph indexes. Solid Flow additionally spends time and memory at initialization building fine-grained dependency metadata, the equivalent of change tracking for materialized views. That metadata lets a later write propagate directly to precisely the derived graph values and UI bindings affected by the change, rather than relying as heavily on broader recomputation and renderer reconciliation to rediscover its consequences. The trade-off depends on the shape of the write. Identity-preserving leaf updates, even thousands of them, retain the benefits of incremental maintenance. Structural replacements or changes that invalidate nearly every row require the same broad recomputation competing implementations perform while also paying Solid Flow's per-row maintenance cost. (Summary by an outside reviewer, 2026-09-26, kept because it is exact.)

The evidence for "precisely the affected bindings" is the DOM mutation count the bench records as its equivalence gate. On a whole-graph replacement with fresh objects of the same ids at 10,000 nodes, Solid Flow performs 10,000 text writes and adds or removes no element; React Flow removes and re-adds 9,999 edge elements and writes 20,000 attributes to re-dress them, and Svelte Flow removes and re-adds 29,997 nodes (each edge plus its two each-block anchors) with the same 20,000 attributes. Their edges are torn down because the fresh node objects arrive unmeasured and the edge rows drop until the nodes are adopted again; here the measurements live in their own root, so the edge rows never notice. The re-add lands after the synchronous flush, so in-page wall time (React 338 ms, Svelte 256, Solid Flow 585) understates them; the CDP task cost that includes it reads 472, 398 and 670. The price of the metadata is the other half of the standings: mount 2,294 ms against 1,868 and 1,352, heap 654 MB against 253 and 451.

The numbers in this section come from the maintainer's private head-to-head bench: twins of the 10,000-node stress page for React Flow 12.12 and Svelte Flow 1.7 driven by one Playwright driver against production builds, with CDP cost metrics and DOM mutation counts as the equivalence gate. Every performance round re-runs the whole suite before it lands, under a keep-the-lead rule: no row where Solid Flow leads may fall behind either library. Standing as of round 42 (2026-09-26): node drag 31 ms of script over 60 moves versus 10,634 (React) and 495 (Svelte); selection drag 107 versus 10,592 and 544; reconnect 10.4 ms versus 185.5 and 12.3; mount to `nodesInitialized` 2,294 ms versus 1,868 and 1,352; heap 654 MB versus 253 and 451.

### Renderers iterate stable id lists

Renderers iterate `visibleNodeIds` / `visibleEdgeIds` and guard per row against not-yet-materialized projection rows. Membership changes never rebuild the list pipeline.

### Two culling tiers

An always-on CSS tier (visibility/pointer-events on off-viewport elements; no userland contract) and the opt-in `onlyRenderVisibleElements` unmount tier (per-row `Show` gates inside the renderer `For`, so the id list stays stable).

### Gesture-scoped spatial lookups

Connection drags and box selection answer closest-handle/containment queries from a spatial grid snapshotted at gesture start (geometry is frozen mid-gesture) instead of upstream's full scans. `getIntersectingNodes` shares a microtask-lifetime grid.

### Avoid monolithic view memos

A memo that maps every row rebuilds all its subscriptions on any recompute. Prefer keyed projections (`projections/presenceIds.ts` is the template — one tiny projection per row deciding its own presence, O(changed-row); `selectedIds` and the unmeasured set behind `nodesInitialized` use it; `connections` and the marker index use per-row memos merged by a record projection).

### No memo-backed prop sources on per-row paths

`merge()` wraps a function source in a memo, and the compiler emits exactly that for a JSX spread with a dynamic expression (`{...node().domAttributes}` becomes `merge({…bindings}, () => …)`). Every binding on that element then reads through the memo, and each read marks the whole dirty heap while thousands of rows are mounting — ~3s of a 12s 10k mount (profile, bench round 17). Per-row components apply dynamic attribute bags with a direct `spread(el, () => attrs, true)` from the ref, and the internal `store` reads config through plain getters (`propGetters`), never a memo source.

### No effects over a row's own ref signal

An effect whose source is written while the row mounts (`createEffect(() => nodeRef(), …)` with `ref={setNodeRef}`) is dirty for the rest of the synchronous mount and sits in the engine's pure heap; every later row's first memo pull re-marks that whole heap (`markHeap`), which made a 10k mount O(N²) — 9.6s → 4.3s once removed (bench rounds 17–18, standalone repro in the maintainer's private spikes; upstream solidjs/solid#3350). Per-row components wire their element from the ref callback, owner-bound: `runWithOwner(owner, () => mountElement(el))`, with `el` captured as a plain value and the effects inside depending on node fields and props only.

### Row elements mount in the settle flush, never inside the initial render

The engine builds the same 10k-row tree 20–30% cheaper in a post-settle flush than inside `render()` (engine-only repro in the maintainer's private spikes), and in the standalone path the pan-zoom's first layout read and the culling viewport otherwise land AFTER the rows (forced layout of 10k nodes, every culled memo re-run). `NodeRenderer` and `EdgeRenderer` gate their lists on a `rowsReady` signal that `SolidFlow` flips at the end of `onSettled`, after `setDomNode` — 10k standalone mount 3.6 s → 3.1 s (bench round 30).

The STORE is still seeded synchronously: children read the graph during their own setup (the hooks contract), and the async/optimistic seeding paths are untouched — deferring the seed itself was tried and rejected for both reasons. The server has no settle and hydration must claim the server-rendered rows, so both render rows immediately (`isServer`, `sharedConfig.isHydrationInProgress`).

### Keyed records hold frozen holders, never row proxies

A projection slot assigned a store proxy is unwrapped on write and re-wrapped on read under the RECORD's projection family, so every nested leaf a consumer reads through `internalNodes[id]` (`measured.width`, `internals.positionAbsolute`, …) becomes a signal owned by the long-lived record instead of the row — and the engine never unlinks a projection's leaf signals when a key is deleted, so deleted rows stayed reachable (with their last values) for the flow's lifetime: ~26 KB per deleted node+edge pair, 260 MB after delete-all @10k (bench round 20, headless repro in the maintainer's private spikes; upstream solidjs/solid#3351).

`createRowRecordProjection` stores one `Object.freeze({ get row() })` holder per row store (frozen objects are not wrappable — served raw) behind `createRecordFacade`, so `record[id]` IS the row store's own proxy and nested leaves die with the row. `edgeLookup` is the same helper over a keyed `mapArray`. Retained after delete-all @10k: 260 → 37 MB (the example's own arrays); mounted heap −13% (one signal per leaf instead of two).

### The state never holds DOM past the canvas

`SolidFlowProvider` hoists the state above `SolidFlow`, so the canvas can unmount while the state lives on; `domNode` alone pinned the whole detached subtree and every delegated handler on it (~490 MB after unmount @10k). The canvas clears `domNode` in its cleanup and `Zoom` destroys the pan/zoom controller and clears `panZoom` with the pane (`unmountRelease.test.tsx`). A hoisted state keeps its DATA by contract (~320 MB @10k); a flow under its own provider releases everything (24 MB, the example's arrays).

### Per-row render costs (bench round 21)

Three rules for the wrappers and anything rendered once per node/edge/handle: (1) resolve the row ONCE (`const node = createMemo(() => nodeLookup.get(id))`) — every binding reads it, and each resolution through the record is two store-slot reads (holder slot, row slot), or a record-wide `in` probe for edges; (2) render the user component through `dynamic(() => component())` from `@solidjs/web`, not `<Dynamic>` — `<Dynamic>` re-copies every prop descriptor per row (`omit(props, "component")`); (3) assign `class` as one string via `cx(...)` (`utils.ts`), never the array/object form — `@solidjs/web` flattens and diffs a key map on every assignment.

Together: 10k mount 3.25 s → 2.6 s, selection drag 0.6 → 0.35 ms/move. What remained in the mount profile was engine store reads, DOM creation, GC and the row derive; Handle's per-instance `propDefaults`/`omit`/`merge` (~100 ms @10k) was the one library-side item left and went in round 36 (see the listeners and attribute spreads section).

### Gesture-scoped lookups for @xyflow/system

System helpers that take a `Map` and SCAN it (XYDrag's `getDragItems` at drag start) get a `SubsetMapView` (`core/subsetMapView.ts`): iteration yields only the candidates the helper will pick anyway (selected ids + the dragged id from the keyed `selectedNodeIds` record), keyed `get`/`has` resolve any node through the full facade. First drag frame @10k 19 → 2 ms (bench round 22). Prefer this over a bespoke drag path: XYDrag's semantics stay upstream's.

### Geometry is reported once, by the row derive

`internalNodes`'s row derive calls `onGeometryChange(id, rect | null)` with the node's absolute rect (plus `parentId`) whenever it changes; the state keeps a plain `nodeGeometry: ReadonlyMap` from it (and bumps `geometryVersion`). Anything that needs EVERY node's rect at a gesture start reads that map — the connection arm (`GestureSpatialLookup.armFrom`), box selection, the minimap's bounds partition (`core/graphBounds.ts`), the intersection commands' per-task grid (`commands/geometry.ts`) — never the row proxies (~2.5 µs per row through the store traps; 25-40 ms per start @10k, bench round 23).

The one remaining gesture-start cost is the browser's style recalc when the root connection classes flip (~25-40 ms @10k: every handle matches the affordance selectors) — by design, one recalc per gesture instead of a class write per handle.

### Big keyed projections: draft form

A projection that RETURNS a fresh record makes the engine reconcile it against the store (`reconcileNextState`/`applyAdopt`) and clone the raw; a draft-form derive that writes only the changed keys avoids that. Reconnect 34 → 21 ms (bench round 24). Until solid-js rc.8 the engine also cloned a projection target's raw on the first root-level write in a derive (~13 ms on a 20k-key record), so `connections` kept root keys stable and pruned emptied sub-records lazily; rc.8 gives projections the prototype-overlay path (solidjs/solid#3352, filed from this code), root writes are O(1), and the derive deletes emptied keys directly. Reconnect 21 → 11 ms on the bump (round 27).

### Per-row projections: reconcile the user change, leaf-write the rest

Draft writes are not free either: every draft read allocates a wrapper proxy and every draft op toggles the engine's write flags, so writing all ~25 row keys through the draft costs about twice the reconcile (bench round 34). The node row derive (`projections/internalNodes.ts`) therefore RETURNS a fresh row when the user snapshot changes (the engine reconciles it, which is also what keeps the `internals.userNode` copy in sync — a proxy written into a store backing is copied, its leaves chain but its slots do not) and on every other run (measurement, overlay, drag, parent move) writes only the leaves that changed, compared against closure-held last values.

Handle bounds are frozen records: frozen objects are not wrappable, so every store serves them raw by identity, the reconcile compares them by reference, and the measurement ingest writes its root leaf-wise with a structural compare so an identical pass notifies nothing (10k mount 2.9 → 2.7 s, heap 819 → 713 MB).

### Per-row listeners and attribute spreads only on demand

The runtime does not delegate `pointerenter`/`pointerleave`, `dblclick` is attached directly, and the compiler attaches a listener even for an `undefined` handler expression, so a wrapper that wires them unconditionally pays one listener per row per event for callbacks nobody passed: 2 per node plus 3 per edge at 10k before rounds 31, 35 and 37, 10,025 total after (the one left per node is d3-drag's). NodeWrapper and EdgeWrapper attach them from the ref callback only when the flow passes the matching prop. `pointermove` follows the same rule for a different reason: it is delegated, and once any module registers a delegated `pointermove` the runtime walks its dispatcher from the pointer to the root on every move of every drag. The library registers none: the pane listens directly (box selection, `onPanePointerMove`) and rows attach one only for a user callback (bench round 53).

Likewise an attribute spread is a render effect that re-enumerates its source on every run: `domAttributes` are spread only once a row has them (`spreadOnDemand`), and BaseEdge and Handle install one only when they were given extra attributes, read once from the keys present when they mount (`extraKeysOf`/`spreadExtras` in `src/utils.ts`). Never write `{...rest}` on a per-row element: the compiler then emits one `spread(el, [rest, {every attribute}])` for the whole element — no static template, and one effect that re-collects all of its attributes on any change (bench rounds 35/36: BaseEdge 169 → 48 ms, Handle 296 → 115 ms inclusive at 10k; mount 2.7 → 2.3 s).

### Whole-graph writes: every per-row map is keyed by id, and the row snapshot skips the keys the row joins itself

A controlled replacement with fresh objects of the same ids (set graph) swaps every array slot; a per-row `mapArray` keyed by identity then disposes and recreates all its rows, and the connections merge removed and re-added every entry (~110 ms of a 771 ms set graph @10k, bench round 41). Presence records, connections and markers key by id like the row stores, so a swap is a re-derive per row and an unchanged row writes nothing.

The node row's user snapshot (`internalNodes.user`) enumerates the row WITHOUT reading `selected` and `dragging` — the derive joins those with the overlays and tracks them directly — through a key-set memo that absorbs a key add, so a selection write is the row's leaf path, not a spread and a reconcile (deselect all 433 → ~345 ms). The flow settings a row reads come through one value-equal memo per projection (one read per run, no row wakes on an unrelated config change), the selection box bounds sample the row derive's plain geometry map on the feed's tick (40 ms → ~2 ms on a select-all), and drag frames leaf-write the moved position in the row and in the overlay entry.

What a row must NOT do is leaf-write a foreign store proxy into its draft (a fresh `data`, or the `edge`): the draft path COPIES the object, and later in-place writes through the user's store would no longer reach the row's readers — a same-id swap therefore still takes the return-form reconcile, which adopts by reference (the `internalNodes` "same-id replacement" tests pin the chaining).

### A node's transform is its own DOM write

The `style` binding diffs a whole object per run; with the transform inside it, every moved node rebuilt and diffed ~7 keys per frame (~55 ms of a 10k move-all, bench round 42). NodeWrapper writes `el.style.transform` from a render effect over `internals.positionAbsolute` and keeps the transform out of the style object on the client (server markup still carries it); a user `transform` is stripped there, since the binding would otherwise write it over the effect's.

### Culling is computed once per step, and each row reads its own signal

The quantized culling viewport steps every quarter-viewport of pan; a per-row memo over it makes every step re-run all ~20k row memos through the store proxies (50–66 ms frames @10k, bench round 26). `onScreenNodeIds` / `onScreenEdgeIds` (`projections/onScreenIds.ts`) compute overlap once per step over the plain geometry maps (a full pass, ~1 ms) and only for the reported ids on a geometry change (`geometryFeed.ts`: rows report rects, the feed bumps an `ownedWrite` tick on every report so the membership settles in the same flush — per report, not per batch, because the selection box bounds sample the same map on the tick and never drain), and notify only the ids that flip. Rows ask `onScreen.has(id)` through `nodeCulled` / `edgeCulled`, which keep the never-cull guards, and read the equality-cut `store.cullingActive` instead of the viewport.

The membership is a plain set plus one boolean signal per subscribed row: the signal is created on the row's first tracked read, dropped by its `unobserved` callback when the last subscriber goes, and an untracked read answers from the set. The sweep is an eager memo nobody reads; it writes the flipped rows' signals with `ownedWrite`, so a row settles in the same flush as the step. Until round 52 the membership was a keyed store record (`id in record` subscribes per key as well), but committing a record that gains and loses keys cost O(keys) per changed key in the few-hundred-key band: the store opens the draft as a prototype overlay of the committed object, V8 turns that object into a fast-mode prototype, and the commit then adds and deletes keys on it (headless repro in the maintainer's private spikes, 5.8 ms per commit at 400 keys with 100 swapped). In the browser that was 1.4–2.1 ms per record at every step of a 10k pan, and ~0.9 ms per frame of a drag at the pane edge, where auto-pan moves both the node and the viewport. Signals have nothing to commit but their flips: pan 22 → 15 ms of script over a 60-move gesture at 10k (bench round 52).

### Never change an inherited CSS property on an ancestor of the graph

`cursor: grabbing` on the pane at drag start cost one ~70 ms style recalc of all 460k descendants @10k (measured: 69 ms per flip; an unrelated class or a non-inherited property 0 ms). The pan cursor is a leaf cover (`.solid-flow__pan-cursor`, rendered by `Zoom` from the first pan MOVE — never on start, a click also starts a d3-zoom gesture and a cover under the mouseup swallows it — until the gesture ends); `.dragging` on the pane keeps its name (parity) but no cursor rule. `selection` keeps its cursor: it can be on at rest, and a cover would intercept clicks.

### Reactive nodes are named

Memos, effects and projections carry `{ name }`, so the rc.7 dev diagnostics (`HUGE_FAN_IN`, `HUGE_FAN_OUT`, `WIDE_SCOPE_DEPS`) and `DEV.attribution.costs()` identify them. The stress example enables attribution with `?attr=1`; `e2e/attribution-probe.spec.ts` prints the warnings and cost tables.

Diagnostics that fire BY DESIGN on a large graph, and must not be "fixed": `visibleNodeIds`/`visibleEdgeIds` (membership id lists read one id per row — inherent, membership cadence only), the renderers' `<For>` insert effects (framework: one child value per row), and `connectionFromHandle` / `cullingViewport` fan-out (every row subscribes on purpose — each changes once per gesture or pan frame and costs O(1) per subscriber). Anything else the diagnostics name is a finding.

### Update budgets in CI

`src/__tests__/diagnosticsBudget.test.ts` (via `@solidjs/diagnostics`) runs a 400-node headless flow, one gesture write per scenario (drag frame, select, reconnect), asserting how many scopes re-ran (budgets 4 / 10 / 6 as of round 41, each a measured value with headroom; the drag frame pins the steady-state second frame, since the first frame of a drag adds the `dragging` key) and that the only diagnostics are the by-design ones (`WIDE_SCOPE_DEPS` on the `selectedIds` and `connections` record merges). On solid-js rc.9 `internalNodes.row` was allowed too, because enumerating a store object subscribed a presence node per key and pushed the row memo past the 30-source line; that was an upstream regression, solidjs/solid#3664, fixed in rc.10, and the allowance went with the bump.

The timing benches measure milliseconds; this pins the granularity they come from. `expectNoWaste` is not usable: draft-form projections return no value, so every per-row derive reads as an unchanged recompute.

## Typing

- **Guided unions**: `createNodeStore<typeof nodeTypes>` narrows each row's `data` by its `type` discriminant against the renderer map; `SolidFlowNode` / `SolidFlowEdge` export the same unions standalone. The optimistic factories mirror the full core surface via overloads.
- **Enum mirrors** (`types/general.ts`): each @xyflow/system enum is exposed as a value + string-union type pair. The _value_ stays the upstream enum object — the only thing assignable into system-typed fields like `NodeBase.sourcePosition` — while the _type_ is the union so literals are first-class everywhere Solid Flow owns the type. Pinned by `enumMirrors.test.ts`.
- The generic-context cast lives in exactly one place (`contexts/flow.ts#typedSolidFlowContext`).

## Testing

Three lanes (`bun run test`, `test:ssr`, `test:e2e`): jsdom unit/component tests co-located in `__tests__/` folders, an SSR lane running the server build, and a Playwright gesture harness (`e2e/`) against the playground. Conventions: failing test first; no vacuous assertions; anything extractable to `core/` gets headless tests; gesture tests share `components/__tests__/gestureHarness.ts`.
