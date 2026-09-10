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
  flow owns membership.

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

Two rules keep the graph correct under 2.0's async model:

- **Never swallow `NotReadyError`.** A broad `try/catch` around store reads in
  a computation breaks the server build: propagation is the re-derive channel
  (solid#3073). Branch on readiness with `isPending()` instead.
- **Component setup is untracked.** Reading a pending async source there is a
  hard error — probe with `isPending` (all access inside the accessor) and
  defer the read to a tracked scope (see the seeding adoption effects).

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
  subscriptions on any recompute. Prefer keyed projections (`selectedIds`'
  per-row presence pattern is the template — O(changed-row)).

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
