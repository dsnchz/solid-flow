// @vitest-environment node
import { createMarkerIds, MarkerType } from "@xyflow/system";
import { createEffect, createRoot, createSignal, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge } from "@/types";

import { createMarkerIndex, type MarkerEntry } from "../projections/markers";

const arrow = { type: MarkerType.Arrow };
const closed = { type: MarkerType.ArrowClosed, color: "red" };

const setup = (initial: Edge[]) => {
  const [edges, setEdges] = createStore<Edge[]>(initial);
  const [defaultColor, setDefaultColor] = createSignal("#b1b1b7");
  let index!: Record<string, MarkerEntry>;
  let dispose!: () => void;
  const runs = { membership: 0 };
  const options = () => ({
    id: "flow",
    defaultColor: defaultColor(),
    defaultMarkerStart: undefined,
    defaultMarkerEnd: undefined,
  });
  createRoot((d) => {
    dispose = d;
    index = createMarkerIndex({
      get edges() {
        return edges;
      },
      get id() {
        return "flow";
      },
      get defaultColor() {
        return defaultColor();
      },
      get defaultMarkerStart() {
        return undefined;
      },
      get defaultMarkerEnd() {
        return undefined;
      },
    });
    createEffect(
      () => Object.keys(index).length,
      () => {
        runs.membership++;
      },
    );
  });
  flush();
  const expected = () => createMarkerIds(edges as Edge[], options());
  const actual = () => Object.values(index).sort((a, b) => a.id.localeCompare(b.id));
  return { edges, setEdges, setDefaultColor, index: () => index, runs, expected, actual, dispose };
};

describe("createMarkerIndex", () => {
  it("matches the system helper: object markers only, defaults applied, deduped, sorted", () => {
    const { actual, expected, dispose } = setup([
      { id: "e1", source: "a", target: "b", markerEnd: arrow },
      { id: "e2", source: "b", target: "c", markerEnd: arrow, markerStart: closed },
      { id: "e3", source: "c", target: "d", markerEnd: "url(#custom)" },
      { id: "e4", source: "d", target: "e" },
    ] as Edge[]);
    expect(actual()).toEqual(expected());
    expect(actual()).toHaveLength(2);
    dispose();
  });

  it("an edge's non-marker write and a same-marker rewrite touch nothing", () => {
    const { setEdges, index, runs, dispose } = setup([
      { id: "e1", source: "a", target: "b", markerEnd: arrow },
      { id: "e2", source: "b", target: "c", markerEnd: arrow },
    ] as Edge[]);
    const entry = Object.values(index())[0];
    expect(runs.membership).toBe(1);

    setEdges((draft) => {
      draft[1]!.source = "z";
      draft[1]!.markerEnd = { type: MarkerType.Arrow };
    });
    flush();
    expect(Object.values(index())[0]).toBe(entry);
    expect(runs.membership).toBe(1);
    dispose();
  });

  it("a marker change on one edge updates only the id set that changed", () => {
    const { setEdges, index, runs, actual, expected, dispose } = setup([
      { id: "e1", source: "a", target: "b", markerEnd: arrow },
      { id: "e2", source: "b", target: "c", markerEnd: arrow },
    ] as Edge[]);
    const arrowEntry = Object.values(index())[0];

    setEdges((draft) => {
      draft[1]!.markerEnd = closed;
    });
    flush();
    expect(actual()).toEqual(expected());
    expect(Object.keys(index())).toHaveLength(2);
    expect(Object.values(index()).find((m) => m === arrowEntry)).toBe(arrowEntry);
    expect(runs.membership).toBe(2);
    dispose();
  });

  it("follows the default color for markers without their own", () => {
    const { setDefaultColor, actual, expected, dispose } = setup([
      { id: "e1", source: "a", target: "b", markerEnd: arrow },
    ] as Edge[]);
    expect(actual()[0]!.color).toBe("#b1b1b7");
    setDefaultColor("blue");
    flush();
    expect(actual()[0]!.color).toBe("blue");
    expect(actual()).toEqual(expected());
    dispose();
  });
});
