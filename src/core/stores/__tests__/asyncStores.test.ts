// @vitest-environment node
import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { settle } from "@/__tests__/settle";
import { createEdgeStore, createNodeStore } from "@/core";

// Async-seeded stores (Solid 2.0 "Fetch High"): the function form hands the
// promise straight to createStore's projection derive — no memo required.
// Reads throw NotReadyError until first resolution (a <Loading> boundary
// covers them); afterwards the store is an ordinary writable store.
describe("createNodeStore / createEdgeStore (async function form)", () => {
  it("seeds from a promise and stays writable afterwards", async () => {
    await createRoot(async (dispose) => {
      type SeedNode = {
        id: string;
        type: "default";
        position: { x: number; y: number };
        data: { label: string };
      };
      let resolveFetch!: (v: SeedNode[]) => void;
      const request = new Promise<SeedNode[]>((resolve) => (resolveFetch = resolve));

      const [nodes, setNodes] = createNodeStore(async () => await request);

      const seen: string[] = [];
      createEffect(
        () => {
          try {
            return `len=${nodes.length}`;
          } catch {
            return "not-ready";
          }
        },
        (v) => {
          seen.push(v);
        },
      );
      flush();
      expect(seen).toEqual(["not-ready"]);

      resolveFetch([{ id: "a", type: "default", position: { x: 0, y: 0 }, data: { label: "a" } }]);
      await settle();
      expect(seen).toEqual(["not-ready", "len=1"]);

      // The async seed hands over to normal store semantics: drafts persist.
      setNodes((draft) => {
        draft.push({ id: "b", type: "default", position: { x: 100, y: 0 }, data: { label: "b" } });
      });
      flush();
      expect(nodes).toHaveLength(2);
      expect(nodes[1]!.id).toBe("b");
      dispose();
    });
  });

  it("edge store: same contract", async () => {
    await createRoot(async (dispose) => {
      const [edges, setEdges] = createEdgeStore(async () => {
        // The seed resolves on a later task, like a fetch.
        await new Promise((resolve) => setTimeout(resolve, 0));
        return [{ id: "e1", source: "a", target: "b" }];
      });

      const seen: string[] = [];
      createEffect(
        () => {
          try {
            return edges.length;
          } catch {
            return "not-ready";
          }
        },
        (v) => {
          seen.push(String(v));
        },
      );
      await settle();
      expect(seen).toEqual(["not-ready", "1"]);

      setEdges((draft) => {
        draft.push({ id: "e2", source: "b", target: "c" });
      });
      flush();
      expect(edges).toHaveLength(2);
      dispose();
    });
  });

  it("array form is unchanged (control)", () => {
    createRoot((dispose) => {
      const [nodes] = createNodeStore([
        { id: "a", type: "default", position: { x: 0, y: 0 }, data: { label: "a" } },
      ]);
      expect(nodes).toHaveLength(1);
      dispose();
    });
  });
});
