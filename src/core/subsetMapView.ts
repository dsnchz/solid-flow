/**
 * A read-only `Map` view that ITERATES a candidate subset of a full map but
 * resolves ANY key through it. Built for gesture-scoped lookups handed to
 * @xyflow/system: XYDrag's start scans the whole `nodeLookup` to pick the
 * selected nodes and the dragged node (bench round 22: ~19ms first drag
 * frame @10k through the record facade), while its keyed reads (parents,
 * deleted-while-dragging checks) must still see every node. Candidates are
 * re-read on every iteration; missing ids are skipped. Without candidates
 * (or while a subclass's `candidates()` answers null) it is the full map.
 */
export class SubsetMapView<V> implements Map<string, V> {
  readonly #full: Map<string, V>;
  readonly #select: (() => Iterable<string>) | undefined;

  constructor(full: Map<string, V>, candidates?: () => Iterable<string>) {
    this.#full = full;
    this.#select = candidates;
  }

  /** The ids to iterate, or null for the whole map. */
  protected candidates(): Iterable<string> | null {
    return this.#select ? this.#select() : null;
  }

  get(key: string): V | undefined {
    return this.#full.get(key);
  }

  has(key: string): boolean {
    return this.#full.has(key);
  }

  get size(): number {
    if (this.candidates() === null) return this.#full.size;
    let n = 0;
    for (const _ of this.keys()) n++;
    return n;
  }

  *keys(): MapIterator<string> {
    const candidates = this.candidates();
    if (candidates === null) {
      yield* this.#full.keys();
      return;
    }
    for (const id of candidates) if (this.#full.has(id)) yield id;
  }

  *values(): MapIterator<V> {
    const candidates = this.candidates();
    if (candidates === null) {
      yield* this.#full.values();
      return;
    }
    for (const id of candidates) {
      const value = this.#full.get(id);
      if (value !== undefined) yield value;
    }
  }

  *entries(): MapIterator<[string, V]> {
    const candidates = this.candidates();
    if (candidates === null) {
      yield* this.#full.entries();
      return;
    }
    for (const id of candidates) {
      const value = this.#full.get(id);
      if (value !== undefined) yield [id, value];
    }
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  forEach(callback: (value: V, key: string, map: Map<string, V>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callback.call(thisArg, value, key, this);
  }

  readonly [Symbol.toStringTag]: string = "SubsetMapView";

  #readOnly(): never {
    throw new Error(`${this[Symbol.toStringTag]} is read-only`);
  }

  set(): never {
    return this.#readOnly();
  }

  getOrInsert(): never {
    return this.#readOnly();
  }

  getOrInsertComputed(): never {
    return this.#readOnly();
  }

  delete(): never {
    return this.#readOnly();
  }

  clear(): never {
    return this.#readOnly();
  }
}
