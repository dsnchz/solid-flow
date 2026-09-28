import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { SolidFlowProvider } from "@/components/SolidFlowProvider";
import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

// A wrapper that forwards its own optional props (`minZoom={props.minZoom}`)
// passes an explicit `undefined` whenever its caller leaves one out. The flow
// must treat that as "not set" and keep its defaults.
type Forwarded = {
  minZoom?: number;
  maxZoom?: number;
  nodesDraggable?: boolean;
  colorMode?: "light" | "dark" | "system";
};
const forwarded: Forwarded = {};

describe("explicitly undefined props keep the flow's defaults", () => {
  it("through <SolidFlow>", async () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => ((internal = useInternalSolidFlow()), null);
    const { getByTestId } = render(() => (
      <SolidFlow
        nodes={nodes}
        width={800}
        height={600}
        minZoom={forwarded.minZoom}
        maxZoom={forwarded.maxZoom}
        nodesDraggable={forwarded.nodesDraggable}
        colorMode={forwarded.colorMode}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();

    expect(internal.store.minZoom).toBe(0.5);
    expect(internal.store.maxZoom).toBe(2);
    expect(internal.store.nodesDraggable).toBe(true);
    // "system" resolves through the (stubbed, light) media query
    expect(internal.store.colorMode).toBe("light");
    expect(getByTestId("solid-flow__wrapper").classList.contains("light")).toBe(true);
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
        colorMode={forwarded.colorMode}
      >
        <Probe />
      </SolidFlowProvider>
    ));
    await tick();

    expect(internal.store.minZoom).toBe(0.5);
    expect(internal.store.maxZoom).toBe(2);
    expect(internal.store.nodesDraggable).toBe(true);
    expect(internal.store.colorMode).toBe("light");
  });

  it("an explicit value still wins", async () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => ((internal = useInternalSolidFlow()), null);
    render(() => (
      <SolidFlow nodes={nodes} width={800} height={600} minZoom={0.1} nodesDraggable={false}>
        <Probe />
      </SolidFlow>
    ));
    await tick();

    expect(internal.store.minZoom).toBe(0.1);
    expect(internal.store.nodesDraggable).toBe(false);
  });
});
