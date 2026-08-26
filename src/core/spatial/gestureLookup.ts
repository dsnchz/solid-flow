import type { Rect, XYPosition } from "@xyflow/system";

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
export class GestureSpatialLookup<V> implements Map<string, V> {
  readonly #real: Map<string, V>;
  readonly #cellSize: number;
  #grid: SpatialGrid | null = null;
  #queryRect: Rect | null = null;

  constructor(real: Map<string, V>, cellSize: number) {
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

  #candidateIds(): string[] | null {
    if (!this.#grid || !this.#queryRect) return null;
    return this.#grid.queryRect(this.#queryRect);
  }

  get(key: string): V | undefined {
    return this.#real.get(key);
  }

  has(key: string): boolean {
    return this.#real.has(key);
  }

  get size(): number {
    return this.#real.size;
  }

  *keys(): MapIterator<string> {
    const candidates = this.#candidateIds();
    if (!candidates) {
      yield* this.#real.keys();
      return;
    }
    for (const id of candidates) if (this.#real.has(id)) yield id;
  }

  *values(): MapIterator<V> {
    const candidates = this.#candidateIds();
    if (!candidates) {
      yield* this.#real.values();
      return;
    }
    for (const id of candidates) {
      const value = this.#real.get(id);
      if (value !== undefined) yield value;
    }
  }

  *entries(): MapIterator<[string, V]> {
    const candidates = this.#candidateIds();
    if (!candidates) {
      yield* this.#real.entries();
      return;
    }
    for (const id of candidates) {
      const value = this.#real.get(id);
      if (value !== undefined) yield [id, value];
    }
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  forEach(callback: (value: V, key: string, map: Map<string, V>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callback.call(thisArg, value, key, this);
  }

  readonly [Symbol.toStringTag] = "GestureSpatialLookup";

  set(): never {
    throw new Error("GestureSpatialLookup is read-only");
  }

  getOrInsert(): never {
    throw new Error("GestureSpatialLookup is read-only");
  }

  getOrInsertComputed(): never {
    throw new Error("GestureSpatialLookup is read-only");
  }

  delete(): never {
    throw new Error("GestureSpatialLookup is read-only");
  }

  clear(): never {
    throw new Error("GestureSpatialLookup is read-only");
  }
}
