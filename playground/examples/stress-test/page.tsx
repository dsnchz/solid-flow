import { flush } from "solid-js";
import { Background, Controls, type Edge, MiniMap, type Node, SolidFlow } from "~/index";

// Benchmark-instrumented stress grid. URL params:
//   x, y     grid dimensions (default 25x25 = 625 nodes, 624 chained edges)
//   minimap  "1" to include the MiniMap (default off, to isolate the graph pipeline)
//
// window.__bench.flush lets the driver force synchronous completion of a
// dispatched interaction (Solid 2.0 defers to microtask flush; the 0.2.3
// twin app stubs this with a no-op because 1.x updates synchronously).
export const StressTest = () => {
  const params = new URLSearchParams(window.location.search);
  const xNodes = Number(params.get("x") ?? 25);
  const yNodes = Number(params.get("y") ?? 25);
  const withMiniMap = params.get("minimap") === "1";
  const withEdges = params.get("edges") !== "0";

  const nodeItems: Node[] = [];
  const edgeItems: Edge[] = [];

  let source: Node | null = null;

  for (let y = 0; y < yNodes; y++) {
    for (let x = 0; x < xNodes; x++) {
      const position = { x: x * 100, y: y * 50 };
      const id = `${x}-${y}`;
      const data = { label: `Node ${id}` };
      const node: Node = {
        id,
        data,
        position,
        type: "default",
      };
      nodeItems.push(node);

      if (source && withEdges) {
        const edge: Edge = {
          id: `${source.id}-${id}`,
          source: source.id,
          target: id,
        };
        edgeItems.push(edge);
      }

      source = node;
    }
  }

  (window as Window & { __bench?: unknown }).__bench = { flush };

  return (
    <SolidFlow
      nodes={nodeItems}
      edges={edgeItems}
      fitView
      minZoom={0.1}
      onFlowError={(id, message) => {
        console.error(id, message);
      }}
    >
      <Controls />
      <Background variant="lines" />
      {withMiniMap && <MiniMap />}
    </SolidFlow>
  );
};
