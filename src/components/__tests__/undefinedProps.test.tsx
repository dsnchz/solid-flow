import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { settle } from "@/__tests__/settle";
import { SolidFlow } from "@/components/SolidFlow";
import { SolidFlowProvider } from "@/components/SolidFlowProvider";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

const nodes: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

// A wrapper that forwards its own optional props (`minZoom={props.minZoom}`)
// passes an explicit `undefined` whenever its caller leaves one out. The flow
// must treat that as "not set" and keep its defaults.
type Forwarded = {
  minZoom?: number;
  maxZoom?: number;
  nodesDraggable?: boolean;
  selectionMode?: "partial" | "full";
};
const forwarded: Forwarded = {};

describe("explicitly undefined props keep the flow's defaults", () => {
  it("through <SolidFlow>", async () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => ((internal = useInternalSolidFlow()), null);
    render(() => (
      <SolidFlow
        nodes={nodes}
        width={800}
        height={600}
        minZoom={forwarded.minZoom}
        maxZoom={forwarded.maxZoom}
        nodesDraggable={forwarded.nodesDraggable}
        selectionMode={forwarded.selectionMode}
      >
        <Probe />
      </SolidFlow>
    ));
    await settle();

    expect(internal.store.minZoom).toBe(0.5);
    expect(internal.store.maxZoom).toBe(2);
    expect(internal.store.nodesDraggable).toBe(true);
    expect(internal.store.selectionMode).toBe("partial");
  });

  it("through <SolidFlowProvider>", async () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => ((internal = useInternalSolidFlow()), null);
    render(() => (
      <SolidFlowProvider
        nodes={nodes}
        minZoom={forwarded.minZoom}
        maxZoom={forwarded.maxZoom}
        nodesDraggable={forwarded.nodesDraggable}
        selectionMode={forwarded.selectionMode}
      >
        <Probe />
      </SolidFlowProvider>
    ));
    flush();

    expect(internal.store.minZoom).toBe(0.5);
    expect(internal.store.maxZoom).toBe(2);
    expect(internal.store.nodesDraggable).toBe(true);
    expect(internal.store.selectionMode).toBe("partial");
  });

  it("an explicit value still wins", async () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => ((internal = useInternalSolidFlow()), null);
    render(() => (
      <SolidFlow nodes={nodes} width={800} height={600} minZoom={0.1} nodesDraggable={false}>
        <Probe />
      </SolidFlow>
    ));
    await settle();

    expect(internal.store.minZoom).toBe(0.1);
    expect(internal.store.nodesDraggable).toBe(false);
  });
});
