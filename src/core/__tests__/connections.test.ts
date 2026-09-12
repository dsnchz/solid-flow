// @vitest-environment node
import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge } from "@/types";

import { connectionKey, createConnections } from "../projections/connections";

describe("createConnections (core, headless)", () => {
  it("indexes every edge under node, node-type, and node-type-handle keys", () => {
    const [edges] = createStore([
      { id: "e1", source: "a", target: "b", sourceHandle: "h1" },
    ] as Edge[]);

    createRoot((dispose) => {
      const connections = createConnections({
        get edges() {
          return edges;
        },
      });
      flush();

      expect(Object.keys(connections).sort()).toEqual([
        "a",
        "a-source",
        "a-source-h1",
        "b",
        "b-target",
      ]);
      const entry = Object.values(connections[connectionKey("a", "source", "h1")] ?? {})[0];
      expect(entry).toMatchObject({
        edgeId: "e1",
        source: "a",
        target: "b",
        sourceHandle: "h1",
        targetHandle: null,
      });
      dispose();
    });
  });

  it("only notifies subscribers whose key set actually changed", () => {
    const [edges, setEdges] = createStore([{ id: "e1", source: "a", target: "b" }] as Edge[]);
    const runs = { a: 0, c: 0 };

    createRoot((dispose) => {
      const connections = createConnections({
        get edges() {
          return edges;
        },
      });

      createEffect(
        () => Object.keys(connections[connectionKey("a", "source")] ?? {}).length,
        () => {
          runs.a++;
        },
      );
      createEffect(
        () => Object.keys(connections[connectionKey("c", "source")] ?? {}).length,
        () => {
          runs.c++;
        },
      );
      flush();
      expect(runs).toEqual({ a: 1, c: 1 });

      // second edge from a: a's set changes, c's does not
      setEdges((draft) => {
        draft.push({ id: "e2", source: "a", target: "c" } as Edge);
      });
      flush();
      expect(runs.a).toBe(2);

      // edge FROM c appears: c-source key materializes (absent-key tracking
      // works in effects; the in-derive footgun does not apply here)
      setEdges((draft) => {
        draft.push({ id: "e3", source: "c", target: "b" } as Edge);
      });
      flush();
      expect(runs.c).toBe(2);

      dispose();
    });
  });

  it("an emptied handle key is removed from the record", () => {
    const [edges, setEdges] = createStore([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "a", target: "c" },
    ] as Edge[]);

    createRoot((dispose) => {
      const connections = createConnections({
        get edges() {
          return edges;
        },
      });
      flush();
      expect(Object.keys(connections["a-source"] ?? {})).toHaveLength(2);
      expect(connections["c-target"]).toBeDefined();

      setEdges(() => [{ id: "e1", source: "a", target: "b" }] as Edge[]);
      flush();

      expect(Object.keys(connections["a-source"] ?? {})).toHaveLength(1);
      // deleted, not left as an empty sub-record (rc.8: root deletes are O(1))
      expect(connections["c-target"]).toBeUndefined();
      expect("c-target" in connections).toBe(false);

      setEdges(() => [{ id: "e1", source: "a", target: "b", targetHandle: "fresh" }] as Edge[]);
      flush();
      expect(Object.keys(connections["b-target-fresh"] ?? {})).toHaveLength(1);
      dispose();
    });
  });

  it("an unrelated edge's field write leaves other handles' sub-records identity-stable", () => {
    const [edges, setEdges] = createStore([
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "c", target: "d" },
    ] as Edge[]);

    createRoot((dispose) => {
      const connections = createConnections({
        get edges() {
          return edges;
        },
      });
      flush();
      const aBefore = connections["a"];
      const aSourceBefore = connections[connectionKey("a", "source")];

      // Reconnect e2's target handle: only c/d keys may change. With per-edge
      // row derivations the record diff is O(that edge), and a's sub-records
      // keep their identity (the reactive identity of a's connection set).
      setEdges((draft) => {
        draft[1]!.targetHandle = "in";
      });
      flush();

      expect(connections["a"]).toBe(aBefore);
      expect(connections[connectionKey("a", "source")]).toBe(aSourceBefore);
      expect(Object.keys(connections[connectionKey("d", "target", "in")] ?? {})).toHaveLength(1);
      dispose();
    });
  });
});

describe("createConnections — reconnect (draft-form incremental derive)", () => {
  it("moving an edge between handles updates exactly the two handle keys and keeps every other key's sub-record", () => {
    const [edges, setEdges] = createStore([
      { id: "e1", source: "a", target: "b", targetHandle: "in" },
      { id: "e2", source: "c", target: "b" },
    ] as Edge[]);
    createRoot((dispose) => {
      const connections = createConnections({
        get edges() {
          return edges;
        },
      });
      flush();
      const cBefore = connections[connectionKey("c", "source")];
      const bBefore = connections[connectionKey("b", "target")];
      expect(Object.keys(connections[connectionKey("b", "target", "in")] ?? {})).toHaveLength(1);

      // reconnect e1 to b's default target handle (targetHandle null)
      setEdges((draft) => {
        draft[0]!.targetHandle = null;
      });
      flush();
      expect(Object.keys(connections[connectionKey("b", "target", "in")] ?? {})).toHaveLength(0);
      expect(Object.keys(connections[connectionKey("b", "target")] ?? {})).toHaveLength(2);
      expect(connections[connectionKey("c", "source")]).toBe(cBefore);
      expect(connections[connectionKey("b", "target")]).toBe(bBefore);

      // and back
      setEdges((draft) => {
        draft[0]!.targetHandle = "in";
      });
      flush();
      expect(Object.keys(connections[connectionKey("b", "target", "in")] ?? {})).toHaveLength(1);
      expect(connections[connectionKey("c", "source")]).toBe(cBefore);
      dispose();
    });
  });
});
