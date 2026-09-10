// @vitest-environment node
import { infiniteExtent } from "@xyflow/system";
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import type { NodeGeometry } from "../projections/internalNodes";
import { createInternalNodes, type NodeMeasurements } from "../projections/internalNodes";

// The row derive is the one place that knows a node's absolute rect the
// moment it changes. It reports it (with parentId) so gesture starts —
// connection arm, box selection, minimap partition — read a plain map instead
// of walking every row through the store proxies (bench round 23).
const makeNode = (overrides: Partial<Node> & { id: string }): Node => ({
  position: { x: 0, y: 0 },
  data: {},
  ...overrides,
});

const setup = (initial: Node[]) => {
  const [nodes, setNodes] = createStore<Node[]>(initial);
  const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
  const geometry = new Map<string, NodeGeometry>();
  const calls: [string, NodeGeometry | null][] = [];
  const internalNodes = createInternalNodes({
    selectionOverlay: {},
    dragOverlay: {},
    get nodes() {
      return nodes;
    },
    get measurements() {
      return measurements;
    },
    nodeOrigin: [0, 0],
    nodeExtent: infiniteExtent,
    elevateNodesOnSelect: true,
    onGeometryChange: (id, rect) => {
      calls.push([id, rect]);
      if (rect) geometry.set(id, rect);
      else geometry.delete(id);
    },
  });
  return { internalNodes, setNodes, setMeasurements, geometry, calls };
};

describe("internal node geometry reporting", () => {
  it("reports each row's absolute rect on creation and on every geometry change", () => {
    createRoot((dispose) => {
      const { internalNodes, setNodes, setMeasurements, geometry, calls } = setup([
        makeNode({ id: "a", position: { x: 10, y: 20 }, width: 100, height: 40 }),
        makeNode({ id: "p", position: { x: 500, y: 0 } }),
        makeNode({ id: "c", position: { x: 5, y: 5 }, parentId: "p", width: 20, height: 10 }),
      ]);
      flush();
      void internalNodes.a;
      expect(geometry.get("a")).toEqual({ x: 10, y: 20, width: 100, height: 40 });
      // child rect is absolute; parentId rides along for moving-cascade checks
      expect(geometry.get("c")).toEqual({ x: 505, y: 5, width: 20, height: 10, parentId: "p" });
      const before = calls.length;

      // a measurement changes the size
      setMeasurements((draft) => {
        draft.p = { measured: { width: 80, height: 30 }, handleBounds: undefined } as never;
      });
      flush();
      expect(geometry.get("p")).toEqual({ x: 500, y: 0, width: 80, height: 30 });

      // a position write moves the row (and its child)
      setNodes((draft) => {
        draft[1]!.position = { x: 600, y: 100 };
      });
      flush();
      expect(geometry.get("p")?.x).toBe(600);
      expect(geometry.get("c")).toMatchObject({ x: 605, y: 105 });

      // an unrelated write does not re-report
      const n = calls.length;
      setNodes((draft) => {
        draft[0]!.selected = true;
      });
      flush();
      expect(calls.length).toBe(n);
      expect(calls.length).toBeGreaterThan(before);
      dispose();
    });
  });

  it("reports null when a row is removed", () => {
    createRoot((dispose) => {
      const { setNodes, geometry, calls } = setup([makeNode({ id: "a" }), makeNode({ id: "b" })]);
      flush();
      expect(geometry.has("a")).toBe(true);
      setNodes((draft) => {
        draft.splice(0, 1);
      });
      flush();
      expect(geometry.has("a")).toBe(false);
      expect(geometry.has("b")).toBe(true);
      expect(calls.at(-1)).toEqual(["a", null]);
      dispose();
    });
  });
});
