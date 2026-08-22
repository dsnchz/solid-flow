/**
 * A read-only `Map` view over an id-keyed record projection, for
 * @xyflow/system interop: system helpers take `Map`s, our reactive lookups
 * are records. Every read passes through to the record, so reads inside
 * tracked scopes subscribe normally — `get`/`has` check with `in` first,
 * which also subscribes while the key is still absent (the projection
 * absent-key footgun), and `size`/iteration read the key set structurally.
 *
 * The mutating `Map` methods throw: writes belong to the roots the
 * projection derives from.
 */
export class RecordMapFacade<V> implements Map<string, V> {
  readonly #record: Record<string, V>;

  constructor(record: Record<string, V>) {
    this.#record = record;
  }

  get(key: string): V | undefined {
    return key in this.#record ? this.#record[key] : undefined;
  }

  has(key: string): boolean {
    return key in this.#record;
  }

  get size(): number {
    return Object.keys(this.#record).length;
  }

  *keys(): MapIterator<string> {
    yield* Object.keys(this.#record);
  }

  *values(): MapIterator<V> {
    for (const key of Object.keys(this.#record)) yield this.#record[key]!;
  }

  *entries(): MapIterator<[string, V]> {
    for (const key of Object.keys(this.#record)) yield [key, this.#record[key]!];
  }

  [Symbol.iterator](): MapIterator<[string, V]> {
    return this.entries();
  }

  forEach(callback: (value: V, key: string, map: Map<string, V>) => void, thisArg?: unknown): void {
    for (const [key, value] of this.entries()) callback.call(thisArg, value, key, this);
  }

  readonly [Symbol.toStringTag] = "RecordMapFacade";

  set(): never {
    throw new Error("RecordMapFacade is read-only; write to the projection's source roots");
  }

  getOrInsert(): never {
    throw new Error("RecordMapFacade is read-only; write to the projection's source roots");
  }

  getOrInsertComputed(): never {
    throw new Error("RecordMapFacade is read-only; write to the projection's source roots");
  }

  delete(): never {
    throw new Error("RecordMapFacade is read-only; write to the projection's source roots");
  }

  clear(): never {
    throw new Error("RecordMapFacade is read-only; write to the projection's source roots");
  }
}
