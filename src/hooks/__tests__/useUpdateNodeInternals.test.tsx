import { render } from "@solidjs/testing-library";
import { Position } from "@xyflow/system";
import { createSignal, flush, Show } from "solid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Handle } from "@/components/handle";
import { SolidFlow } from "@/components/SolidFlow";
import { useUpdateNodeInternals } from "@/hooks";
import { useSolidFlow } from "@/hooks/useSolidFlow";

const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

// jsdom lays nothing out: every element measures 0 x 0, and a node with no
// size is never measured. Give elements a size for these tests.
const sized = ["offsetWidth", "offsetHeight"] as const;
beforeEach(() => {
  for (const key of sized)
    Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get: () => 40 });
});
afterEach(() => {
  for (const key of sized) Reflect.deleteProperty(HTMLElement.prototype, key);
});

describe("useUpdateNodeInternals", () => {
  const renderFlow = async () => {
    const [extra, setExtra] = createSignal(false);
    let api!: ReturnType<typeof useSolidFlow>;
    let update!: ReturnType<typeof useUpdateNodeInternals>;
    const Probe = () => {
      api = useSolidFlow();
      update = useUpdateNodeInternals();
      return null;
    };
    const HandlesNode = () => (
      <>
        <Handle type="source" position={Position.Bottom} id="h1" />
        <Show when={extra()}>
          <Handle type="source" position={Position.Right} id="h2" />
        </Show>
      </>
    );
    render(() => (
      <SolidFlow
        defaultNodes={[{ id: "a", type: "handles", position: { x: 0, y: 0 }, data: {} }]}
        nodeTypes={{ handles: HandlesNode }}
        width={800}
        height={600}
      >
        <Probe />
      </SolidFlow>
    ));
    await tick();
    const sourceHandles = () =>
      api.flow.internalNodes.a!.internals.handleBounds?.source?.map((handle) => handle.id);
    return { setExtra, update: () => update, sourceHandles };
  };

  it("re-measures a node's handles on request", async () => {
    const { setExtra, update, sourceHandles } = await renderFlow();
    expect(sourceHandles()).toEqual(["h1"]);

    setExtra(true);
    flush();
    await tick();
    // nothing re-measures a handle added after mount on its own
    expect(sourceHandles()).toEqual(["h1"]);

    update()("a");
    await tick();
    expect(sourceHandles()).toEqual(["h1", "h2"]);
  });

  it("ignores ids with no node element", async () => {
    const { update, sourceHandles } = await renderFlow();
    expect(() => update()(["a", "missing"])).not.toThrow();
    await tick();
    expect(sourceHandles()).toEqual(["h1"]);
  });
});
