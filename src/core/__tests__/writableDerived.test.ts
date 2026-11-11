// @vitest-environment node
import { createRoot, createStore, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Edge, Node } from "@/types";

import { createFlowState } from "../createFlowState";

const makeNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} });

/**
 * Seven flow settings are writable derived signals (`createSignal(() =>
 * config().x)`): a prop seeds them, an action overrides them (Controls'
 * interactivity toggle writes nodesDraggable / nodesConnectable /
 * elementsSelectable; SolidFlow writes the measured width / height). The
 * props here are a store, as SolidFlow's props are a live view: a prop
 * change re-derives only the setting that reads it. Every prop the tests
 * change is present from the start: `propDefaults` fixes the key set when the
 * state is created.
 */
describe("writable derived flow settings", () => {
  const setup = () => {
    const edges: Edge[] = [];
    const [props, setProps] = createStore({
      nodes: [makeNode("a")],
      edges,
      nodesDraggable: true,
      nodesConnectable: true,
      minZoom: 0.5,
      width: 100,
    });
    let state!: ReturnType<typeof createFlowState>;
    let dispose!: () => void;
    createRoot((d) => {
      dispose = d;
      state = createFlowState(props);
    });
    flush();
    return { state, setProps, dispose };
  };

  it("an action's write overrides the prop", () => {
    const { state, dispose } = setup();
    expect(state.store.nodesDraggable).toBe(true);
    state.actions.setNodesDraggable(false);
    flush();
    expect(state.store.nodesDraggable).toBe(false);
    dispose();
  });

  it("the write survives a change to an unrelated prop", () => {
    const { state, setProps, dispose } = setup();
    state.actions.setNodesDraggable(false);
    flush();
    setProps((p) => {
      p.minZoom = 0.25;
    });
    flush();
    expect(state.store.minZoom).toBe(0.25);
    expect(state.store.nodesDraggable).toBe(false);
    dispose();
  });

  it("a later change to the prop itself re-derives the setting", () => {
    const { state, setProps, dispose } = setup();
    state.actions.setNodesDraggable(false);
    flush();
    setProps((p) => {
      p.nodesDraggable = false;
    });
    flush();
    setProps((p) => {
      p.nodesDraggable = true;
    });
    flush();
    expect(state.store.nodesDraggable).toBe(true);
    dispose();
  });

  // solid-js rc.14 (9a213bb): a derive that ignores `prev` discards a write
  // made in the same update as a change to its source; through rc.13 the
  // write won. The prop winning matches React Flow, whose prop-sync effect
  // runs after a store write in the same render.
  it("a prop change in the same update as a write wins, in either order", () => {
    for (const writeFirst of [true, false]) {
      const { state, setProps, dispose } = setup();
      const changeProp = () =>
        setProps((p) => {
          p.width = 300;
        });
      if (!writeFirst) changeProp();
      state.actions.setWidth(200);
      if (writeFirst) changeProp();
      flush();
      expect(state.store.width).toBe(300);
      dispose();
    }
  });

  it("a write after a prop change, in a later update, wins", () => {
    const { state, setProps, dispose } = setup();
    setProps((p) => {
      p.nodesConnectable = false;
    });
    flush();
    state.actions.setNodesConnectable(true);
    flush();
    expect(state.store.nodesConnectable).toBe(true);
    dispose();
  });
});
