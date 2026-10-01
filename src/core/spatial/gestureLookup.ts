import type { Rect, XYPosition } from "@xyflow/system";

import { SubsetMapView } from "../subsetMapView";
import { SpatialGrid } from "./grid";

/**
 * A gesture-scoped spatial view over a node lookup, for @xyflow/system
 * interop (RFC-4239 dossier, win #1). During a connection gesture, upstream's
 * `getClosestHandle` runs `getNodesWithinDistance` — a full iteration of
 * `nodeLookup.values()` — on EVERY pointermove. Node geometry is frozen for
 * the whole gesture (only the camera moves), so this facade snapshots the
 * node rects into a uniform grid once at gesture start (`arm`) and answers
 * iteration from the grid cells around the current pointer
 * (`setQueryCenter`, updated by a capture-phase listener that runs before
 * XYHandle's own handler on the same event).
 *
 * Correctness: the armed `values()` yields exactly the nodes overlapping the
 * pointer-centered query rect — the same set upstream's overlap prefilter
 * would produce — and `get`/`has` always resolve against the REAL lookup, so
 * validation paths see every node. Unarmed (or before the first move), it
 * behaves exactly like the real lookup.
 */
export class GestureSpatialLookup<V> extends SubsetMapView<V> {
  readonly #real: Map<string, V>;
  readonly #cellSize: number;
  #grid: SpatialGrid | null = null;
  #queryRect: Rect | null = null;

  constructor(real: Map<string, V>, cellSize: number) {
    super(real);
    this.#real = real;
    this.#cellSize = cellSize;
  }

  /** Snapshot the current geometry into the grid (gesture start). */
  arm(rectOf: (value: V) => Rect): void {
    const grid = new SpatialGrid(this.#cellSize);
    for (const [id, value] of this.#real.entries()) {
      grid.insert(id, rectOf(value));
    }
    this.#grid = grid;
    this.#queryRect = null;
  }

  /** Snapshot from a plain geometry map (the row derive's) — no proxy reads. */
  armFrom(geometry: ReadonlyMap<string, Rect>): void {
    const grid = new SpatialGrid(this.#cellSize);
    geometry.forEach((rect, id) => {
      grid.insert(id, rect);
    });
    this.#grid = grid;
    this.#queryRect = null;
  }

  /** Focus iteration on the neighborhood of the pointer (per move). */
  setQueryCenter(center: XYPosition, radius: number): void {
    this.#queryRect = {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  /** Focus iteration on an explicit rect (box-selection gestures). */
  setQueryRect(rect: Rect): void {
    this.#queryRect = rect;
  }

  /** Back to plain pass-through (gesture end). */
  disarm(): void {
    this.#grid = null;
    this.#queryRect = null;
  }

  /** The grid cells around the query rect; the whole lookup until armed and focused. */
  protected override candidates(): Iterable<string> | null {
    if (!this.#grid || !this.#queryRect) return null;
    return this.#grid.queryRect(this.#queryRect);
  }

  /** The REAL lookup's size, armed or not (as upstream's own lookup reports it). */
  override get size(): number {
    return this.#real.size;
  }

  override readonly [Symbol.toStringTag]: string = "GestureSpatialLookup";
}
