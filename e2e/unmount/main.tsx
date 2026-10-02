import { render } from "@solidjs/web";
import { createSignal, flush, onCleanup, Show } from "solid-js";

import { SolidFlow } from "@/components/SolidFlow";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import { Background, Controls } from "@/plugins";
import type { Edge, Node } from "@/types";

// A bare flow — no SolidFlowProvider, which keeps the flow state alive across
// an unmount by design — that e2e/unmount.spec.ts mounts and unmounts.
// `?shape=nested` renders it as an inner <Show>'s fallback (the bench page's
// shape): the 8ef4e1b leak only showed when the flow was disposed that way.
const nested = new URLSearchParams(window.location.search).get("shape") === "nested";
const nodes: Node[] = Array.from({ length: 36 }, (_, i) => ({
  id: `n${i}`,
  position: { x: (i % 6) * 120, y: Math.floor(i / 6) * 80 },
  data: { label: `n${i}` },
}));
const edges: Edge[] = nodes.slice(1).map((node, i) => ({
  id: `e${i}`,
  source: `n${i}`,
  target: node.id,
}));

// A child that holds the flow's API, as an app's toolbar would.
const Probe = () => {
  const w = window as unknown as { __api?: unknown };
  w.__api = useSolidFlow();
  // nothing of the test's may keep the unmounted flow reachable
  onCleanup(() => delete w.__api);
  return null;
};

const canvas = () => (
  <SolidFlow
    {...{ nodes, edges }}
    fitView={false}
    minZoom={0.1}
    elevateEdgesOnSelect={true}
    onFlowError={(id, message) => console.error(id, message)}
  >
    <Probe />
    <Controls />
    <Background variant="lines" />
  </SolidFlow>
);

const [mounted, setMounted] = createSignal(true);
(window as unknown as { __fixture: unknown }).__fixture = { setMounted, flush };

render(
  () => (
    <Show when={mounted()}>
      {nested ? (
        <Show when={false} fallback={canvas()}>
          {null}
        </Show>
      ) : (
        canvas()
      )}
    </Show>
  ),
  document.getElementById("root")!,
);
