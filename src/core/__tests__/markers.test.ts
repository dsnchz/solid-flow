// @vitest-environment node
import { createMarkerIds, type EdgeMarker, MarkerType } from "@xyflow/system";
import { createEffect, createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge } from "@/types";

import { createEdgeMarkers } from "../projections/markers";

// The edge rows report their own markers; the list must match
// @xyflow/system's createMarkerIds over the same edges, and wake its readers
// only when the set of unique markers (id + color) changes.

const arrow = { type: MarkerType.Arrow };
const closed = { type: MarkerType.ArrowClosed, color: "red" };

const setup = (defaults?: { start?: EdgeMarker; end?: EdgeMarker }) =>
  createRoot((dispose) => {
    const [defaultColor, setDefaultColor] = createSignal("#b1b1b7", { ownedWrite: true });
    const options = {
      id: "flow",
      get defaultColor() {
        return defaultColor();
      },
      defaultMarkerStart: defaults?.start,
      defaultMarkerEnd: defaults?.end,
    };
    const markers = createEdgeMarkers(options);
    const runs = { list: 0 };
    createEffect(
      () => markers.list(),
      () => {
        runs.list++;
      },
    );
    const edges = new Map<string, Edge>();
    const report = (edge: Edge) => {
      edges.set(edge.id, edge);
      markers.set(edge.id, edge.markerStart, edge.markerEnd);
    };
    const remove = (id: string) => {
      edges.delete(id);
      markers.remove(id);
    };
    const expected = () => createMarkerIds([...edges.values()], options);
    return { dispose, markers, runs, report, remove, expected, setDefaultColor };
  });

describe("createEdgeMarkers", () => {
  it("matches the system helper: object markers only, defaults applied, deduped, sorted", () => {
    const { dispose, markers, report, expected } = setup({ start: closed });
    report({ id: "e1", source: "a", target: "b", markerEnd: arrow });
    report({ id: "e2", source: "b", target: "c", markerEnd: arrow, markerStart: closed });
    report({ id: "e3", source: "c", target: "d", markerEnd: "url(#custom)" });
    report({ id: "e4", source: "d", target: "e" });
    flush();
    expect(markers.list()).toEqual(expected());
    expect(markers.list()).toHaveLength(2);
    dispose();
  });

  it("applies a default marker only while some edge has none of its own", () => {
    const { dispose, markers, report, remove, expected } = setup({ end: closed });
    report({ id: "e1", source: "a", target: "b", markerEnd: arrow });
    flush();
    expect(markers.list()).toEqual(expected());
    expect(markers.list().map((m) => m.type)).toEqual([MarkerType.Arrow]);
    report({ id: "e2", source: "b", target: "c" });
    flush();
    expect(markers.list()).toEqual(expected());
    expect(markers.list()).toHaveLength(2);
    remove("e2");
    flush();
    expect(markers.list()).toEqual(expected());
    expect(markers.list()).toHaveLength(1);
    dispose();
  });

  it("keeps a shared marker until its last edge goes; an equal rewrite wakes nothing", () => {
    const { dispose, markers, runs, report, remove } = setup();
    report({ id: "e1", source: "a", target: "b", markerEnd: arrow });
    report({ id: "e2", source: "b", target: "c", markerEnd: arrow });
    flush();
    const list = markers.list();
    const before = runs.list;

    // a fresh object of an equal marker, and a non-marker change (same values)
    report({ id: "e2", source: "z", target: "c", markerEnd: { type: MarkerType.Arrow } });
    report({ id: "e1", source: "a", target: "b", markerEnd: arrow });
    flush();
    expect(markers.list()).toBe(list);
    expect(runs.list).toBe(before);

    remove("e1");
    flush();
    expect(markers.list()).toBe(list);
    remove("e2");
    flush();
    expect(markers.list()).toEqual([]);
    expect(runs.list).toBe(before + 1);
    dispose();
  });

  it("follows the default color for markers without their own", () => {
    const { dispose, markers, report, expected, setDefaultColor } = setup();
    report({ id: "e1", source: "a", target: "b", markerEnd: arrow, markerStart: closed });
    flush();
    expect(markers.list().map((m) => m.color)).toEqual(["red", "#b1b1b7"]);
    setDefaultColor("blue");
    flush();
    expect(markers.list()).toEqual(expected());
    expect(markers.list().map((m) => m.color)).toEqual(["red", "blue"]);
    dispose();
  });
});
