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

  it("drops keys when their last connection is removed", () => {
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
      expect(connections["c-target"]).toBeUndefined();
      dispose();
    });
  });
});
