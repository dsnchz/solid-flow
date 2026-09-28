import "@/styles/style.css";

import { Position } from "@xyflow/system";

import { SolidFlow } from "@/components/SolidFlow";
import { Background, Controls, MiniMap } from "@/plugins";
import type { Edge, Node } from "@/types";

// The SSR smoke app (e2e/ssr.spec.ts): served by @solidjs/vite-plugin's start
// mode with `ssr: true` (e2e/ssr/vite.config.ts), the plugin's replacement
// for SolidStart. Nodes declare width/height and handles: with no DOM on the
// server, those are what the server lays out from (README SSR contract).
const handle = (type: "source" | "target", position: Position) => ({
  type,
  position,
  x: 72,
  y: position === Position.Bottom ? 37 : -3,
  width: 6,
  height: 6,
});

const node = (
  id: string,
  type: string | undefined,
  x: number,
  y: number,
  handles: Node["handles"],
): Node => ({
  id,
  ...(type ? { type } : {}),
  position: { x, y },
  data: { label: id },
  width: 150,
  height: 40,
  handles,
});

const nodes: Node[] = [
  node("in", "input", 250, 50, [handle("source", Position.Bottom)]),
  node("mid", undefined, 250, 200, [
    handle("target", Position.Top),
    handle("source", Position.Bottom),
  ]),
  node("out", "output", 250, 350, [handle("target", Position.Top)]),
];
const edges: Edge[] = [
  { id: "e1", source: "in", target: "mid" },
  { id: "e2", source: "mid", target: "out", type: "smoothstep" },
];

export default function App() {
  return (
    <SolidFlow defaultNodes={nodes} defaultEdges={edges} width={1000} height={600}>
      <Background />
      <Controls />
      <MiniMap />
    </SolidFlow>
  );
}
