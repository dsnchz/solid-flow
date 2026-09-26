// @vitest-environment node
import { infiniteExtent, Position } from "@xyflow/system";
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
  // Adopted rows carry `measured` from the start (seeded by the flow).
  const [nodes, setNodes] = createStore<Node[]>([
    { id: "a", position: { x: 0, y: 0 }, data: {}, measured: {} },
  ]);
  const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
  const ids = () => nodes.map((node) => node.id);

  // The row derive reads `selectionOverlay` exactly once per run (the flow
  // settings are read through a shared memo since round 41), so a counting
  // getter on the (plain, untracked) source object counts derive runs.
  let deriveRuns = 0;
  const overlay = {};
  const internalNodes = createInternalNodes({
    get selectionOverlay() {
      deriveRuns++;
      return overlay;
    },
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
    // Measurement-first: with a DOM measurement present the derive never
    // reads the user row's `measured`, so the leaf write-through into the
    // seeded object does not even re-run it (bench round 38).
    expect(runs()).toBe(2);
    expect(boundsRuns).toBe(1);
  });

  it("the measured write-through into a seeded row does not re-enumerate the user node", () => {
    // Every adopted row carries `measured` from the start, so the DOM pass's
    // write-through is two leaf writes into an existing object — the row's
    // key set and slots are untouched, the user snapshot does not re-run,
    // and the row is not rebuilt (bench round 38).
    let enumerations = 0;
    const raw = new Proxy({ id: "a", position: { x: 0, y: 0 }, data: {}, measured: {} } as Node, {
      ownKeys(target) {
        enumerations++;
        return Reflect.ownKeys(target);
      },
    });
    const [nodes, setNodes] = createStore<Node[]>([raw]);
    const [measurements, setMeasurements] = createStore<NodeMeasurements>({});
    const ids = () => nodes.map((node) => node.id);
    const internalNodes = createRoot(() =>
      createInternalNodes({
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
      }),
    );
    const ingest = createRoot(() =>
      createMeasurementIngest<Node>({
        setMeasurementsStore: setMeasurements,
        setNodesStore: setNodes,
        nodeIds: ids,
        nodeIndex: createRowIndex<Node>(ids),
      }),
    );
    flush();
    void internalNodes["a"]!.internals.positionAbsolute;

    const pass = (width: number) => {
      ingest.applyMeasurementWrites([
        { id: "a", measured: { width, height: 60 }, handleBounds: handleBounds("a") },
      ]);
      flush();
      ingest.applyNodeChanges([{ id: "a", type: "dimensions", dimensions: { width, height: 60 } }]);
      flush();
    };
    // The first write into a caller-owned raw object is the engine's one-time
    // copy-on-write privatization (it clones the row, which enumerates it);
    // from then on the raw is owned and a leaf write enumerates nothing.
    pass(120);
    const afterFirstPass = enumerations;
    pass(130);
    expect(nodes[0]!.measured).toEqual({ width: 130, height: 60 });
    expect(internalNodes["a"]!.measured).toEqual({ width: 130, height: 60 });
    expect(enumerations).toBe(afterFirstPass);
  });

  it("a row without measured (a raw user store) gets the key from its first write-through", () => {
    const [nodes, setNodes] = createStore<Node[]>([
      { id: "a", position: { x: 0, y: 0 }, data: {} },
    ]);
    const [, setMeasurements] = createStore<NodeMeasurements>({});
    const ids = () => nodes.map((node) => node.id);
    const ingest = createRoot(() =>
      createMeasurementIngest<Node>({
        setMeasurementsStore: setMeasurements,
        setNodesStore: setNodes,
        nodeIds: ids,
        nodeIndex: createRowIndex<Node>(ids),
      }),
    );
    ingest.applyNodeChanges([
      { id: "a", type: "dimensions", dimensions: { width: 120, height: 60 } },
    ]);
    flush();
    expect(nodes[0]!.measured).toEqual({ width: 120, height: 60 });
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
