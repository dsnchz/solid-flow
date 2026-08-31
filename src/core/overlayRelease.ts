import type { NodeLookup } from "@xyflow/system";
import { createEffect, flush, onCleanup, type StoreSetter } from "solid-js";

import type { DragOverlay } from "./dragOverlay";
import type { SelectionOverlay } from "./selectionOverlay";

export type OverlayReleaseDeps = {
  readonly selectionOverlay: { readonly nodes: SelectionOverlay; readonly edges: SelectionOverlay };
  readonly setSelectionOverlay: StoreSetter<{ nodes: SelectionOverlay; edges: SelectionOverlay }>;
  readonly dragOverlay: DragOverlay;
  readonly setDragOverlay: StoreSetter<DragOverlay>;
  // Only existence checks — the release path must not read rows through the
  // derived records (see the marking-wave note below).
  readonly nodeLookup: Pick<NodeLookup, "has">;
  readonly hasEdge: (id: string) => boolean;
};

/**
 * Overlay release (confirm-then-release, core/selectionOverlay.ts): delete
 * an entry once the row STABLY carries the written value — the write-through
 * landed, so the row (and later user writes) can govern. Confirmation is
 * re-verified on a macrotask: an optimistic write is briefly visible before
 * its transaction reverts it, and effects observe that transient — only a
 * post-settle re-check separates "landed" (plain store) from "reverted"
 * (optimistic store).
 *
 * The compute reads rows through the proxies CAPTURED IN THE ENTRIES —
 * never through nodeLookup/edgeLookup: pulling a derived keyed record
 * inside the write flush triggered an O(sources) marking wave (~130ms
 * @10k, the residual of bench round 12b). Entries for rows that left the
 * graph are swept in the deferred timer (off-frame), where record pulls
 * are harmless.
 */
export const createOverlayRelease = ({
  selectionOverlay,
  setSelectionOverlay,
  dragOverlay,
  setDragOverlay,
  nodeLookup,
  hasEdge,
}: OverlayReleaseDeps) => {
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(releaseTimer));
  createEffect(
    () => {
      const candidates: ["nodes" | "edges", string][] = [];
      for (const id in selectionOverlay.nodes) {
        const entry = selectionOverlay.nodes[id]!;
        if (!!entry.row.selected === entry.value) candidates.push(["nodes", id]);
      }
      for (const id in selectionOverlay.edges) {
        const entry = selectionOverlay.edges[id]!;
        if (!!entry.row.selected === entry.value) candidates.push(["edges", id]);
      }
      const dragCandidates: string[] = [];
      for (const id in dragOverlay) {
        const entry = dragOverlay[id]!;
        if (
          !entry.dragging &&
          entry.row.position.x === entry.position.x &&
          entry.row.position.y === entry.position.y
        ) {
          dragCandidates.push(id);
        }
      }
      return { candidates, dragCandidates };
    },
    ({ candidates, dragCandidates }) => {
      if (!candidates.length && !dragCandidates.length) return;
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        const confirmed = candidates.filter(([kind, id]) => {
          const entry = selectionOverlay[kind][id];
          return entry !== undefined && !!entry.row.selected === entry.value;
        });
        const dragConfirmed = dragCandidates.filter((id) => {
          const entry = dragOverlay[id];
          return (
            entry !== undefined &&
            !entry.dragging &&
            entry.row.position.x === entry.position.x &&
            entry.row.position.y === entry.position.y
          );
        });
        // Off-frame sweep: entries whose rows left the graph. Record pulls
        // are fine here — no flush is in flight.
        const goneSel: ["nodes" | "edges", string][] = [];
        for (const id in selectionOverlay.nodes) {
          if (!nodeLookup.has(id)) goneSel.push(["nodes", id]);
        }
        for (const id in selectionOverlay.edges) {
          if (!hasEdge(id)) goneSel.push(["edges", id]);
        }
        const goneDrag: string[] = [];
        for (const id in dragOverlay) {
          if (!nodeLookup.has(id)) goneDrag.push(id);
        }
        if (confirmed.length || goneSel.length) {
          setSelectionOverlay((draft) => {
            for (const [kind, id] of [...confirmed, ...goneSel]) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete draft[kind][id];
            }
          });
        }
        if (dragConfirmed.length || goneDrag.length) {
          setDragOverlay((draft) => {
            for (const id of [...dragConfirmed, ...goneDrag]) {
              // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
              delete draft[id];
            }
          });
        }
        if (confirmed.length || dragConfirmed.length || goneSel.length || goneDrag.length) flush();
      }, 0);
    },
  );
};
