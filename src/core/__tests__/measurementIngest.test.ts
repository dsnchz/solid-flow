// @vitest-environment node
import { infiniteExtent, type NodeOrigin, Position } from "@xyflow/system";
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "@/types";

import { createMeasurementIngest } from "../measurementIngest";
import { createInternalNodes, type NodeMeasurements } from "../projections/internalNodes";
import { createRowIndex } from "../rowIndex";

// Headless tests for the DOM-pass ingest: what a measuring pass writes into
// the measurements root, and what those writes cost the row projections.

const handleBounds = (nodeId: string, x = 46) => ({
  source: [
    {
      id: null,
      type: "source" as const,
      nodeId,
      position: Position.Bottom,
      x,
      y: 36,
      width: 8,
      height: 8,
    },
  ],
  target: null,
});

const setup = () => {
  const [nodes, setNodes] = createStore<Node[]>([{ id: "a", position: { x: 0, y: 0 }, data: {} }]);
  const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
  const ids = () => nodes.map((node) => node.id);

  // The row derive reads `nodeOrigin` exactly once per run, so a counting
  // getter on the (plain, untracked) source object counts derive runs.
  let deriveRuns = 0;
  const internalNodes = createInternalNodes({
    selectionOverlay: {},
    dragOverlay: {},
    get nodes() {
      return nodes;
    },
    get measurements() {
      return measurements;
    },
    get nodeOrigin(): NodeOrigin {
      deriveRuns++;
      return [0, 0];
    },
    nodeExtent: infiniteExtent,
    elevateNodesOnSelect: true,
  });

  const ingest = createMeasurementIngest<Node>({
    setMeasurementsStore: setMeasurements,
    setNodesStore: setNodes,
    nodeIds: ids,
    nodeIndex: createRowIndex<Node>(ids),
  });

  return { internalNodes, ingest, measurements, runs: () => deriveRuns };
};

describe("createMeasurementIngest — applyMeasurementWrites", () => {
  it("an identical measuring pass does not re-run the row derive", () => {
    // A ResizeObserver tick or a forced updateNodeInternals can report the
    // same dimensions and handle bounds again. The measurements root is
    // ours, so the ingest writes leaves in place and an equal pass writes
    // nothing — no row re-derive, no edge re-layout downstream.
    const { internalNodes, ingest, runs } = createRoot(() => setup());
    flush();
    expect(internalNodes["a"]!.internals.positionAbsolute).toEqual({ x: 0, y: 0 });
    expect(runs()).toBe(1);

    const write = () =>
      ingest.applyMeasurementWrites([
        { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
      ]);

    write();
    flush();
    expect(internalNodes["a"]!.measured).toEqual({ width: 120, height: 60 });
    expect(internalNodes["a"]!.internals.handleBounds?.source?.[0]?.x).toBe(46);
    expect(runs()).toBe(2);

    write();
    flush();
    expect(runs()).toBe(2);
  });

  it("a changed dimension lands as a leaf write: the entry keeps identity, subscribers fire once", () => {
    const { internalNodes, ingest, measurements, runs } = createRoot(() => setup());
    flush();
    void internalNodes["a"];

    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();
    const entryBefore = measurements["a"];
    const boundsBefore = measurements["a"]!.handleBounds;

    let widthRuns = 0;
    createRoot(() => {
      createEffect(
        () => internalNodes["a"]!.measured.width,
        () => {
          widthRuns++;
        },
      );
    });
    flush();
    expect(widthRuns).toBe(1);

    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 130, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();
    expect(internalNodes["a"]!.measured).toEqual({ width: 130, height: 60 });
    expect(widthRuns).toBe(2);
    expect(measurements["a"]).toBe(entryBefore);
    // Equal handle bounds are not re-assigned.
    expect(measurements["a"]!.handleBounds).toBe(boundsBefore);
    expect(runs()).toBe(3);
  });

  it("the measured write-through after a pass does not re-run a handleBounds subscriber", () => {
    // The DOM pass is followed by applyNodeChanges (dimensions written
    // through to the user row): the rebuild it triggers must keep the handle
    // bounds the pass landed, or every edge of the node re-lays out.
    const { internalNodes, ingest, runs } = createRoot(() => setup());
    flush();
    void internalNodes["a"];
    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();

    let boundsRuns = 0;
    createRoot(() => {
      createEffect(
        () => internalNodes["a"]!.internals.handleBounds,
        () => {
          boundsRuns++;
        },
      );
    });
    flush();
    expect(boundsRuns).toBe(1);

    ingest.applyNodeChanges([
      { id: "a", type: "dimensions", dimensions: { width: 120, height: 60 } },
    ]);
    flush();
    expect(internalNodes["a"]!.measured).toEqual({ width: 120, height: 60 });
    expect(runs()).toBe(3);
    expect(boundsRuns).toBe(1);
  });

  it("changed handle bounds replace the previous bounds", () => {
    const { internalNodes, ingest } = createRoot(() => setup());
    flush();
    void internalNodes["a"];

    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();
    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a", 50) },
    ]);
    flush();
    expect(internalNodes["a"]!.internals.handleBounds?.source?.[0]?.x).toBe(50);
  });

  it("a hidden write clears handle bounds and keeps dimensions; the next pass restores them", () => {
    const { internalNodes, ingest } = createRoot(() => setup());
    flush();
    void internalNodes["a"];

    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();
    ingest.applyMeasurementWrites([{ id: "a", hidden: true }]);
    flush();
    expect(internalNodes["a"]!.measured).toEqual({ width: 120, height: 60 });
    expect(internalNodes["a"]!.internals.handleBounds).toBeUndefined();

    ingest.applyMeasurementWrites([
      { id: "a", measured: { width: 120, height: 60 }, handleBounds: handleBounds("a") },
    ]);
    flush();
    expect(internalNodes["a"]!.internals.handleBounds?.source?.[0]?.x).toBe(46);
  });
});
