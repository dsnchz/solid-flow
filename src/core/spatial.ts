import type { Rect } from "@xyflow/system";

/**
 * A uniform spatial hash over axis-aligned rects — the plain, NON-reactive
 * building block behind the flow's spatial queries (RFC-4239 dossier:
 * gesture-scoped snapshots and epoch-rebuilt indexes; deliberately never a
 * live-maintained reactive structure, which would re-create the round-6
 * central-collection anti-pattern).
 *
 * Every operation is O(cells touched); with cellSize on the order of the
 * query radius or median node size, inserts and queries touch O(1) cells.
 * No balancing, no extent-known-up-front requirement, no dependency —
 * upstream's own bake-off (quadtree vs BVH vs rbush) is why: fixed-radius
 * neighborhood and rect-vs-box queries are the textbook grid case.
 */
export class SpatialGrid {
  private readonly cells = new Map<string, string[]>();
  private readonly rects = new Map<string, Rect>();

  constructor(private readonly cellSize: number) {}

  private cellRange(rect: Rect) {
    const size = this.cellSize;
    return {
      minX: Math.floor(rect.x / size),
      maxX: Math.floor((rect.x + rect.width) / size),
      minY: Math.floor(rect.y / size),
      maxY: Math.floor((rect.y + rect.height) / size),
    };
  }

  insert(id: string, rect: Rect): void {
    this.rects.set(id, rect);
    const { minX, maxX, minY, maxY } = this.cellRange(rect);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = `${cx}:${cy}`;
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(id);
        else this.cells.set(key, [id]);
      }
    }
  }

  /** Ids of entries whose rect overlaps the query rect (touching counts). */
  queryRect(query: Rect): string[] {
    const { minX, maxX, minY, maxY } = this.cellRange(query);
    const seen = new Set<string>();
    const result: string[] = [];
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const bucket = this.cells.get(`${cx}:${cy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          if (seen.has(id)) continue;
          seen.add(id);
          const rect = this.rects.get(id)!;
          if (
            rect.x <= query.x + query.width &&
            rect.x + rect.width >= query.x &&
            rect.y <= query.y + query.height &&
            rect.y + rect.height >= query.y
          ) {
            result.push(id);
          }
        }
      }
    }
    return result;
  }

  get size(): number {
    return this.rects.size;
  }
}
