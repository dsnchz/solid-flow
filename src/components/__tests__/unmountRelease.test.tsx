import { render } from "@solidjs/testing-library";
import { createSignal, flush, Show } from "solid-js";
import { describe, expect, it } from "vitest";

import { useInternalSolidFlow } from "@/contexts";
import type { Node } from "@/types";

import { SolidFlow } from "../SolidFlow";
import { SolidFlowProvider } from "../SolidFlowProvider";

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 200, y: 0 }, data: {}, width: 100, height: 40 },
];

/**
 * With state hoisted into a SolidFlowProvider, unmounting the SolidFlow
 * canvas must release every DOM handle the state holds: `domNode` pins the
 * whole detached canvas subtree (and every delegated handler on it) for the
 * provider's lifetime, and the pan/zoom controller keeps the pane element and
 * its d3 bindings alive (bench round 20: ~490 MB retained after unmount @10k).
 */
describe("SolidFlow unmount under a provider", () => {
  it("clears domNode and panZoom from the hoisted state", () => {
    const [mounted, setMounted] = createSignal(true);
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    const rendered = render(() => (
      <SolidFlowProvider defaultNodes={nodes}>
        <Probe />
        <Show when={mounted()}>
          <SolidFlow width={800} height={600} />
        </Show>
      </SolidFlowProvider>
    ));
    flush();
    expect(internal.store.domNode).toBeInstanceOf(HTMLDivElement);
    expect(internal.store.panZoom).not.toBeNull();
    expect(rendered.container.querySelector(".solid-flow")).not.toBeNull();

    setMounted(false);
    flush();
    expect(rendered.container.querySelector(".solid-flow")).toBeNull();
    expect(internal.store.domNode).toBeNull();
    expect(internal.store.panZoom).toBeNull();
    // the hoisted data survives the canvas: it is the provider's, not the canvas's
    expect(internal.store.nodes.length).toBe(2);
  });
});
