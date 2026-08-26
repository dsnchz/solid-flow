import { Loading } from "@solidjs/web";

import {
  Background,
  Controls,
  createEdgeStore,
  createNodeStore,
  type EdgeConnection,
  MiniMap,
  SolidFlow,
} from "@/index";

// Async-seeded stores ("Fetch High"): pass an async function instead of an
// array — no memo, no lifecycle juggling. Reads are not-ready until the data
// lands, so the <Loading> boundary below holds the whole flow; afterwards
// the stores behave exactly like their array-seeded counterparts (drafts,
// adoption, wholesale replacement). e2e/async-data.spec.ts drives this.
const API_LATENCY_MS = 800;

const fetchNodes = async () => {
  await new Promise((resolve) => setTimeout(resolve, API_LATENCY_MS));
  return [
    {
      id: "1",
      type: "input" as const,
      data: { label: "Fetched input" },
      position: { x: 250, y: 0 },
    },
    {
      id: "2",
      type: "default" as const,
      data: { label: "Fetched node" },
      position: { x: 100, y: 100 },
    },
    {
      id: "3",
      type: "output" as const,
      data: { label: "Fetched output" },
      position: { x: 250, y: 200 },
    },
  ];
};

const fetchEdges = async () => {
  await new Promise((resolve) => setTimeout(resolve, API_LATENCY_MS));
  return [{ id: "e1-2", source: "1", target: "2" }];
};

export const AsyncData = () => {
  const [nodes] = createNodeStore(fetchNodes);
  const [edges, setEdges] = createEdgeStore(fetchEdges);

  // Controlled-store contract is unchanged after the async seed: the store
  // owns membership, so connections still get adopted here.
  const onConnect = (connection: EdgeConnection) => {
    setEdges((draft) => {
      draft.push(connection);
    });
  };

  return (
    <Loading
      fallback={
        <div
          data-testid="graph-loading"
          style={{ display: "grid", "place-items": "center", height: "100vh" }}
        >
          Loading graph from the API…
        </div>
      }
    >
      <SolidFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
        <Controls />
        <MiniMap />
        <Background variant="dots" />
      </SolidFlow>
    </Loading>
  );
};
