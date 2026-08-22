import { createEffect, createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node } from "~/types";

import { createParentIds } from "./parentIds";

const makeNode = (id: string, parentId?: string): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...(parentId ? { parentId } : {}),
});

describe("createParentIds (core, headless)", () => {
  it("marks exactly the nodes that have children", () => {
    const [nodes] = createStore([makeNode("group"), makeNode("child", "group"), makeNode("loner")]);

    createRoot((dispose) => {
      const parentIds = createParentIds({
        get nodes() {
          return nodes;
        },
      });
      flush();
      expect(Object.keys(parentIds)).toEqual(["group"]);
      dispose();
    });
  });

  it("drops parent-ness when the last child is removed (stale-parent regression)", () => {
    // The old parentLookup ReactiveMap was populated by adoption and never
    // pruned: a node whose children were all removed stayed marked as parent.
    const [nodes, setNodes] = createStore<Node[]>([makeNode("group"), makeNode("child", "group")]);
    let groupRuns = 0;

    createRoot((dispose) => {
      const parentIds = createParentIds({
        get nodes() {
          return nodes;
        },
      });
      createEffect(
        () => !!parentIds.group,
        () => {
          groupRuns++;
        },
      );
      flush();
      expect(parentIds.group).toBe(true);
      expect(groupRuns).toBe(1);

      setNodes(() => [makeNode("group")]);
      flush();
      expect(parentIds.group).toBeUndefined();
      expect(groupRuns).toBe(2);
      dispose();
    });
  });

  it("does not re-run a parent's subscriber for unrelated membership changes", () => {
    const [nodes, setNodes] = createStore<Node[]>([makeNode("g1"), makeNode("c1", "g1"), makeNode("g2")]);
    let g1Runs = 0;

    createRoot((dispose) => {
      const parentIds = createParentIds({
        get nodes() {
          return nodes;
        },
      });
      createEffect(
        () => !!parentIds.g1,
        () => {
          g1Runs++;
        },
      );
      flush();
      expect(g1Runs).toBe(1);

      // g2 becomes a parent; g1's subscriber must not care
      setNodes((draft) => {
        draft.push(makeNode("c2", "g2"));
      });
      flush();
      expect(g1Runs).toBe(1);
      dispose();
    });
  });
});
