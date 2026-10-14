# Repro: a non-keyed `<Show>` child memo re-runs after its condition turned falsy inside an action

Branch for a solidjs/solid issue. Base: `@dschz/solid-flow` `next` at `addaf7a`, with solid-js, @solidjs/web, @solidjs/signals, @solidjs/compiler and @solidjs/diagnostics at `2.0.0-rc.15` (the only change besides the test and this file).

```bash
bun install
bunx vitest run src/core/__tests__/showStaleInAction.test.ts   # fails on rc.15 / rc.14: REACTIVITY_HALTED
```

To see it pass on rc.13, set the five Solid packages in `package.json` back to `2.0.0-rc.13` (and `@solidjs/vite-plugin` to `3.0.0-next.47`), `bun install`, and run the same command.

The test renders the headless flow state (`src/core/createFlowState.ts`) through solid-js `For` / `Show` with one eager memo per row, then runs an action that adds a node and selects it (`addNodes`, then `updateNode(id, { selected: true })`) before its `yield`. Inside the select step (`src/core/commands/elements.ts`, `updateNode`) the crash needs all four of: the row-index memo read (`nodeIndex.indexOf`, an untracked memo read inside the setter), the `selected` field write on the row, the nested selection-overlay write that holds the row proxy, and the `Object.assign` of the patch.
