# Solid Flow `next`: Architectural Direction

## Purpose

This document captures the intended next step for the architecture of Solid Flow's `next` branch.

The goal is **not** to rewrite the library for its own sake. The goal is to continue pushing the current Solid-native design until the flow engine is expressed primarily as a **reactive graph of authoritative sources and derived projections**, with a thin imperative command layer for mutations.

The core idea is:

> **Thin imperative shell, fat declarative graph.**

Solid Flow should increasingly resemble a headless reactive system that happens to have a UI attached to it, rather than a UI component tree that happens to contain state.

---

# 1. Architectural Thesis

Solid 2 makes it possible to treat application state, derivations, async work, and rendering as distinct concerns.

The desired architecture is:

```text
                 ┌─ nodes
Commands ───────>├─ edges
                 ├─ viewport
                 └─ measurements
                       │
                       ▼
               PURE REACTIVE GRAPH
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
 internalNodes     connections      layout
       │               │               │
       └───────────────┼───────────────┘
                       ▼
                      UI
```

The UI should be a **consumer** of the graph, not the place where graph orchestration lives.

The command layer should mutate only authoritative sources. All secondary structures should, wherever practical, be derived.

---

# 2. The Main Architectural Question

When adding or reviewing internal state, ask:

> **Is this actually state, or is it knowledge derived from other state?**

If a value can be completely determined from authoritative inputs, it should generally be represented as a projection rather than as separately mutable state.

For example:

```text
nodes + measurements
        ↓
internalNodes
```

If `internalNodes` can always be reconstructed from `nodes`, `measurements`, and configuration, then `internalNodes` should not need an independent write API.

Likewise:

```text
edges
  ├──> edgeLookup
  ├──> connections
  └──> other edge-derived structures
```

If these structures are fully determined by `edges`, they should not require synchronization procedures, garbage collection passes, or imperative maintenance.

---

# 3. Desired Top-Level Shape

The long-term shape of flow state should conceptually look like this:

```text
Flow
├── Sources
│   ├── nodes
│   ├── edges
│   ├── measurements
│   ├── viewport
│   └── interaction
│
├── Projections
│   ├── internalNodes
│   ├── nodeLookup
│   ├── parentLookup
│   ├── connections
│   ├── edgeLookup
│   ├── layoutedEdges
│   └── visibleElements
│
└── Commands
    ├── addNode
    ├── removeNode
    ├── updateNode
    ├── connect
    ├── disconnect
    ├── moveNode
    ├── setMeasurement
    └── setViewport
```

This does not require those exact names or APIs.

The important distinction is architectural:

- **Sources** are authoritative and writable.
- **Projections** are derived and preferably readonly.
- **Commands** are the explicit mutation surface.
- **Rendering** subscribes to the graph.

---

# 4. Authoritative Sources

The number of writable roots should stay small.

Likely examples include:

## Nodes

User-authored or externally controlled node state.

```text
nodes
```

This is the domain-level representation of the graph, not the rendering-specific or layout-enriched representation.

## Edges

User-authored or externally controlled edges.

```text
edges
```

## Measurements

DOM- or renderer-derived geometry that cannot be inferred from domain state alone.

```text
measurements
```

This should remain conceptually separate from user node state.

A measurement is an observed fact about the rendered node, not part of the user's graph definition.

## Viewport

Pan, zoom, and related viewport state.

```text
viewport
```

## Interaction State

State that is inherently ephemeral and procedural may remain writable.

Examples may include:

- current drag state
- active connection gesture
- selection gesture
- pointer interaction state
- temporary interaction coordinates

The goal is not to force all mutable state away.

The goal is to distinguish **true mutable state** from values that are merely cached consequences of other state.

---

# 5. Projections

A projection should answer:

> Given the current authoritative facts, what must be true?

Examples:

## Internal Nodes

```text
nodes + measurements + config
              ↓
       internalNodes
```

Internal nodes should increasingly be understood as a projection over user nodes plus renderer-derived measurements and configuration.

They should not require a separate synchronization pipeline if the same result can be derived reactively.

## Node Lookup

```text
internalNodes
      ↓
 nodeLookup
```

If `nodeLookup` is only an indexed representation of internal nodes, it is knowledge, not source state.

## Parent Lookup

```text
internalNodes
      ↓
 parentLookup
```

If hierarchy information is completely determined by the graph, the lookup should be derived.

## Edge Lookup

```text
edges
  ↓
edgeLookup
```

Avoid maintaining this separately if it can be projected from `edges`.

## Connections

```text
edges
  ↓
connections
```

The relationship graph should be derived from edge state rather than incrementally repaired after every write, unless profiling proves otherwise.

## Layouted Edges

```text
edges + internalNodes + config
             ↓
       layoutedEdges
```

Geometry and rendering metadata should be computed downstream of authoritative graph state.

## Visibility

```text
internalNodes + layoutedEdges + viewport
                 ↓
          visibleElements
```

Visibility is another example of derived knowledge.

---

# 6. Commands Should Be Boring

The command layer should be explicit but small.

A command should change authoritative state and let the graph propagate the consequences.

Good:

```text
moveNode(...)
    ↓
update authoritative node position
    ↓
reactive graph derives everything else
```

Bad:

```text
moveNode(...)
    ↓
update node
    ↓
update internal node
    ↓
update node lookup
    ↓
update parent lookup
    ↓
recalculate layout
    ↓
repair visibility
    ↓
notify rendering
```

The second approach encodes synchronization as procedure.

The first encodes synchronization as dependency structure.

That is the central architectural goal.

---

# 7. Prefer Structural Invariants Over Synchronization Code

A strong design should make invalid intermediate states difficult or impossible to represent.

For example, with separately maintained state this may exist:

```text
edges             = newEdges
edgeLookup        = oldEdges
connectionLookup  = oldEdges
```

Even if this mismatch is transient, it is a state the system must reason about.

With projection-based state:

```text
edges
  ├──> edgeLookup
  └──> connections
```

the secondary representations are always consequences of the current edge state.

The system has fewer possible inconsistent states.

This improves:

- correctness
- debuggability
- testability
- maintainability
- agent-generated code quality

---

# 8. Why This Fits Solid 2

Solid 2's model strongly favors expressing causality directly.

The desired mental model is:

```text
source
  ↓
derived fact
  ↓
derived fact
  ↓
consumer
```

The same model applies whether a computation is synchronous or asynchronous.

The architecture therefore should not require a special "async layer" between state and UI.

An async source or projection is still part of the same graph.

Conceptually:

```text
flowId
  ↓
nodes
  ↓
internalNodes
  ↓
layout
  ↓
UI
```

If `nodes` happens to involve async work, that should not require redesigning the rest of the graph.

Likewise, independent work should remain independent:

```text
          flowId
          /    \
         ↓      ↓
      nodes   metadata
```

These may proceed concurrently.

A waterfall should arise only when the graph contains a true dependency:

```text
flowId
  ↓
nodes
  ↓
permissionsDerivedFromNodes
```

The architecture should describe causality and let execution follow from it.

---

# 9. Headless-First State Model

Solid Flow state should remain usable without rendering.

That means the core graph should be testable and useful in contexts such as:

- unit tests
- SSR
- server-side evaluation
- non-DOM renderers
- workers where practical
- alternate UI layers
- debugging tools
- future devtools

The UI should consume state rather than create the meaning of state.

Desired direction:

```text
             Solid Flow State
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
      Tests         SSR       Renderer
```

This is a stronger boundary than simply "moving logic out of components."

The flow system should exist independently; components should be one adapter over it.

---

# 10. Testing Philosophy

Projection-oriented architecture should make tests more declarative.

Instead of testing procedures:

```text
call update
then call another update
then flush
then inspect synchronized caches
```

prefer testing invariants:

```text
Given:
  nodes = X
  measurements = Y

Then:
  internalNodes = Z
```

Or:

```text
Given:
  edges = E

Then:
  edgeLookup = L
  connections = C
```

Or:

```text
Given:
  nodes = N
  edges = E
  viewport = V

Then:
  visibleElements = R
```

This lets tests describe guarantees rather than implementation choreography.

A large increase in testability is a signal that the state boundaries are improving.

---

# 11. Avoid Reintroducing XYFlow's Upstream Mutation Model

Solid Flow uses `@xyflow/system`, but it should not inherit React Flow or Svelte Flow's orchestration model merely because the algorithms are shared.

Shared algorithms are useful.

Shared state architecture is not required.

The intended interpretation is:

```text
@xyflow/system
      │
      ├── React Flow
      │     external mutable store + synchronization
      │
      ├── Svelte Flow
      │     reactive runtime + mutable internal structures
      │
      └── Solid Flow
            authoritative roots
                  ↓
            reactive projections
                  ↓
               renderer
```

When integrating an upstream system helper, do not automatically adopt its mutable state assumptions.

Prefer adapting the helper at a boundary.

---

# 12. Facades Are Preferable to Polluting the Internal Model

If `@xyflow/system` expects structures such as `Map`, but Solid's preferred reactive representation is different, use an adapter or facade when possible.

Conceptually:

```text
Solid-native representation
          ↓
       facade
          ↓
   @xyflow/system API
```

Do not let an upstream API requirement dictate the authoritative internal reactive representation unless there is a compelling reason.

---

# 13. Read/Write Segregation Is a Feature

Solid's explicit read/write model should be reflected in architecture.

Prefer exposing:

```text
readable projections
+
explicit commands
```

rather than general mutable objects.

For example:

```text
internalNodes
```

should ideally be readable but not generally writable.

If a consumer needs to cause a change, it should mutate an authoritative source through a defined command.

This gives the system a capability-oriented shape:

```text
consumer
   │
   ├── may read projection
   │
   └── may receive specific command capability
```

That makes data ownership easier to reason about.

---

# 14. Optimization Should Follow Semantics

Do not prematurely preserve mutable caches merely because they appear faster.

First prefer the architecture that most accurately expresses dependency relationships.

For example:

```text
edges
  ↓
connections
```

is preferable to manually maintaining `connections` after every edge mutation if the derived implementation performs adequately.

Only introduce incremental mutation/caching when profiling demonstrates a real issue.

If optimization becomes necessary, preserve the same conceptual ownership model:

- one authoritative source
- derived representations
- no duplicate semantic authority

A cache may exist as an implementation detail, but it should not become a competing source of truth.

---

# 15. Performance Invariants to Preserve

Projection-oriented design must still respect fine-grained identity and update behavior.

Important considerations include:

- preserve row/item identity where possible
- avoid rewrapping whole collections on unrelated changes
- ensure projections invalidate only the necessary dependents
- avoid broad subscriptions in render paths
- avoid rebuilding expensive indexes without need if a more granular derived representation is available
- prefer keyed projection behavior where identity matters

The goal is not merely functional correctness.

The goal is:

> **The straightforward reactive expression should also be the performant expression.**

If a particular projection causes unnecessary churn, refine the projection rather than abandoning the source/projection architecture by default.

---

# 16. Migration Strategy

Do not attempt a large rewrite.

For every existing piece of `createFlowState`, classify it as one of:

```text
SOURCE
PROJECTION
COMMAND
ADAPTER
RENDERER CONCERN
```

Then migrate incrementally.

Recommended sequence:

## Step 1: Identify authoritative state

Document which values truly need writes.

## Step 2: Identify synchronized derivatives

Look for values that are currently updated because another value changed.

Examples:

- lookup maps
- relationship indexes
- computed node representations
- edge geometry
- visibility
- hierarchy data

## Step 3: Replace one synchronization path at a time

Convert a maintained structure into a projection.

## Step 4: Remove obsolete write paths

Once a value is derived, eliminate code that mutates or repairs it.

## Step 5: Add invariant tests

Verify the projection from its authoritative inputs.

## Step 6: Measure identity and performance

Ensure the new projection preserves expected granularity.

## Step 7: Repeat

The architecture should become simpler as synchronized state disappears.

---

# 17. Code Review Questions

For every change to flow state, ask:

1. Is this new value actually authoritative?
2. If not, can it be a projection?
3. Does this mutation update more than one semantic representation of the same fact?
4. Could a dependency express that relationship instead?
5. Is a cache being mistaken for state?
6. Does the UI own logic that could exist headlessly?
7. Does this command mutate only authoritative inputs?
8. Can this behavior be tested without mounting components?
9. Are async dependencies represented as actual graph dependencies?
10. Would an independent async operation accidentally serialize?
11. Are read and write capabilities clearly separated?
12. Does an upstream XYFlow helper require mutable state, or can it be adapted through a facade?
13. Does the implementation preserve item identity and fine-grained invalidation?
14. If an imperative synchronization step exists, is it truly necessary?

---

# 18. Anti-Patterns

Avoid introducing patterns like:

## Duplicate writable representations

```text
nodes
internalNodes
nodeLookup
```

all independently mutable.

## Synchronization cascades

```text
setNodes()
  → rebuild internals
  → update lookup
  → repair hierarchy
  → recalculate layout
```

unless unavoidable.

## UI-owned domain state

Do not require components to exist for core flow state to become valid.

## Hidden write paths

Avoid allowing consumers to mutate projections directly.

## Async orchestration in rendering

Do not make the component tree responsible for deciding when independent work may start.

## Framework-style optimization rituals

Avoid APIs where users or internal code must manually annotate dependencies that the reactive graph can infer.

---

# 19. Target Architectural Invariant

The strongest version of the architecture can be summarized as:

> **Every mutable value should correspond to an independent fact in the system. Every non-independent fact should be derived.**

That gives Solid Flow a small number of real sources of truth and a large graph of consequences.

Conceptually:

```text
                FACTS
        ┌────────┼────────┐
        ▼        ▼        ▼
      nodes     edges   measurements
        │        │        │
        └────────┼────────┘
                 ▼
            DERIVATIONS
                 │
      ┌──────────┼──────────┐
      ▼          ▼          ▼
 internalNodes lookups   geometry
      │          │          │
      └──────────┼──────────┘
                 ▼
              RENDER
```

Commands modify facts.

Projections describe consequences.

The renderer observes consequences.

---

# 20. Definition of Success

The architecture is moving in the right direction when:

- `createFlowState` contains fewer synchronization procedures
- derived structures have no write side
- command functions become smaller
- state can be exercised without DOM mounting
- unit tests describe invariants instead of update choreography
- invalid intermediate combinations become harder to represent
- upstream XYFlow algorithms remain reusable without dictating state ownership
- async work composes naturally into the same graph
- independent async operations do not waterfall without a true dependency
- rendering code becomes increasingly thin
- the distinction between "naive" implementation and "optimized" implementation narrows

The end state should feel less like a traditional mutable store and more like:

> **a graph definition plus a command surface.**

That is the architectural direction for Solid Flow `next`.

---

# Appendix: Empirical Ground Truth (repo-specific)

Everything above states the ideals. This section pins them to what has been
**measured** in this repository on solid-js `2.0.0-rc.1`, so the ideals are
not misread as license to ignore the measurements. When this appendix and the
body disagree about implementation tactics, the appendix wins until upstream
changes the facts.

## The naive projection expression is not yet the performant one (§14, §15)

The straightforward derivation of this exact architecture — monolithic
projections over the roots — benchmarked at **19.4 ms per drag move at 625
nodes**, 34× worse than the 0.2.x mutable-store line. The shipped
implementation reaches **0.5–0.7 ms** with identical DOM output granularity
by _refining the projection implementation_, not abandoning the model:

- **Per-row sub-stores**: each internal node / layouted edge is its own keyed
  `createProjection` in a `{ row }` wrapper, created inside an id-keyed
  `mapArray` (item-accessor form, so controlled array resets reuse row
  scopes). Leaf signals hang off their row's computed, which keeps
  invalidation O(changed).
- **Shallow record-of-proxies**: the public records are shallow draft-form
  projections holding row proxies by reference, with explicit `delete` for
  removed ids. The `assigned` identity maps inside them are §14's "cache as
  implementation detail" — they carry no semantic authority.
- **Input roots are plain writable stores, not projections of props**:
  deriving the node/edge arrays from a store-proxy source rewraps every
  element on structural writes and churns the whole pipeline (verified
  empirically).

Full history and numbers: `.agent/bench/p32-vs-023.md` (four rounds of
architecture bake-off, plus round 5 for viewport culling).

## rc.1 sharp edges every projection must respect

Discovered empirically, each pinned by a spike or test; two are filed
upstream (solidjs/solid **#3037** dead computed, **#3038** companion walk —
dossiers in `.agent/issues/`, runnable repros on branch
`repro/solid-rc1-issues`):

- Absent-key reads do not subscribe inside derives; structural reads
  (`Object.keys`, `.size`) do. Bail-out paths must take a structural read.
- `delete draft[k]` is REQUIRED to remove a key; assigning `undefined` keeps
  the own key and skips the structural notify.
- The first nested projection derive can register **zero** dependencies while
  another projection's store commits beneath its reads (browser-only, #3037).
  Workaround: re-assert the presence-deciding reads at the END of the derive.
- Every flush pays a companion-chain walk proportional to materialized
  signals (#3038). The sub-store shape shortens the chains; the residual tax
  is why drag cost still grows with N at 10k nodes.
- Projections derive on flush even when unread; signal writes inside
  `createRoot` callbacks throw (store drafts are fine); `mapArray` creates
  replacement rows BEFORE disposing removed ones.

If upstream fixes land, the workarounds should be deleted and the gap the
body calls "naive vs optimized" narrows — re-run the bench before and after.

## Visibility is core knowledge with leaf-granular application (§5)

§5 lists `visibleElements` as a projection. Deliberately, there is **no
core-level visible-elements collection**: a single derived collection is
exactly the broad-subscription, identity-churning shape that benchmarked
worse than rendering everything (v1 autopsy in
`.agent/planning/only-render-visible-elements.md`). Instead:

- The _determination_ is core-owned and headless-tested:
  `src/core/culling.ts` — the overscanned, quantized `cullingViewport` memo
  plus pure `isNodeCulled` / `isEdgeCulled` predicates.
- The _application_ is two tiers, both leaf-granular:
  - **CSS tier (always on)**: a per-element flag memo in each wrapper
    writing `visibility` + `pointer-events` only.
  - **Unmount tier (opt-in `onlyRenderVisibleElements`, bench round 6)**: a
    per-row flag memo in each renderer gating a `<Show>` around the wrapper.
    Off-viewport rows are not mounted at all — at 10k that is 16x less DOM,
    ~half the heap, and 3.7x faster drags (fewer live observers under
    upstream #3038). The equality cut is the point: a geometry change
    recomputes one row's boolean; the id lists (`visibleNodeIds` /
    `visibleEdgeIds`) stay full and stable. Guards: selected, unmeasured,
    `cullable: false` (user opt-out, both tiers), the focused element
    (renderer-local focusin/focusout tracking), and nodes whose
    `internals.handleBounds` have not populated in THIS flow instance —
    `measured` is written back to the user's node objects, so a persisted
    layout or a remounted flow arrives "pre-measured", and trusting it
    would cull the node before its one mount, permanently starving its
    edges of `getEdgePosition` geometry (found via the cullable tests;
    handle bounds live in the per-flow measurements store and survive
    unmount-culling, so the guard cannot oscillate). `NodeWrapper`
    unobserves its element from the shared ResizeObserver on dispose. The
    data graph is untouched — remounted rows return at their cached
    measured size.

Either way there is still no derived collection: the central filtered-list
shape re-reads every row per change and measured 5x slower at 10k than the
per-row gate (round 6). This is §15 applied to §5 — do not "fix" it into a
collection.

## Verification discipline

- Spike before believing: runnable scripts in `.agent/spikes/p32/`, run with
  `node --conditions=browser --conditions=development`.
- jsdom passing ≠ browser passing for projection-timing bugs; smoke the
  playground in a real browser.
- Check `document.visibilityState` before diagnosing browser misbehavior:
  hidden tabs suspend rendering steps, which suspends ResizeObserver
  delivery and rAF — convincingly impersonating "the build is broken"
  (dead container measurement, inert zoom/fitView, inert culling).
- Benchmarks: prod build, visible tab, fully synchronous drivers
  (`window.__bench.flush` + `window.__bench.api` seams in the stress
  example; `unmount=1` / `fit=0` params for A/B).
