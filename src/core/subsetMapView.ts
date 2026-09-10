/**
 * A read-only `Map` view that ITERATES a candidate subset of a full map but
 * resolves ANY key through it. Built for gesture-scoped lookups handed to
 * @xyflow/system: XYDrag's start scans the whole `nodeLookup` to pick the
 * selected nodes and the dragged node (bench round 22: ~19ms first drag
 * frame @10k through the record facade), while its keyed reads (parents,
 * deleted-while-dragging checks) must still see every node. Candidates are
 * re-read on every iteration; missing ids are skipped.
 */
export class SubsetMapView<V> implements Map<string, V> {
  readonly #full: Map<string, V>;
  readonly #candidates: () => Iterable<string>;

  constructor(full: Map<string, V>, candidates: () => Iterable<string>) {
    this.#full = full;
    this.#candidates = candidates;
  }

  get(key: string): V | undefined {
    return this.#full.get(key);
  }

  has(key: string): boolean {
    return this.#full.has(key);
  }

  get size(): number {
    let n = 0;
    for (const _ of this.keys()) n++;
    return n;
  }

  *keys(): MapIterator<string> {
    for (const id of this.#candidates()) if (this.#full.has(id)) yield id;
  }

  *values(): MapIterator<V> {
    for (const id of this.keys()) yield this.#full.get(id)!;
  }

  *entries(): MapIterator<[string, V]> {
    for (const id of this.keys()) yield [id, this.#full.get(id)!];
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  forEach(callback: (value: V, key: string, map: Map<string, V>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callback.call(thisArg, value, key, this);
  }

  readonly [Symbol.toStringTag] = "SubsetMapView";

  set(): never {
    throw new Error("SubsetMapView is read-only");
  }

  getOrInsert(): never {
    throw new Error("SubsetMapView is read-only");
  }

  getOrInsertComputed(): never {
    throw new Error("SubsetMapView is read-only");
  }

  delete(): never {
    throw new Error("SubsetMapView is read-only");
  }

  clear(): never {
    throw new Error("SubsetMapView is read-only");
  }
}
