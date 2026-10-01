import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import * as api from "@/index";

// The package's runtime exports, pinned. Adding or removing one is a public
// API decision: update this list in the same commit. Components follow the
// union of React Flow's and Svelte Flow's public components; the renderers,
// wrappers, containers and `*Internal` edges stay internal.
const PUBLIC_RUNTIME_EXPORTS = [
  "Background",
  "BaseEdge",
  "BezierEdge",
  "ConnectionLineType",
  "ConnectionMode",
  "ControlButton",
  "Controls",
  "EdgeLabel",
  "EdgeLabelRenderer",
  "EdgeReconnectAnchor",
  "EdgeToolbar",
  "Handle",
  "MarkerType",
  "MiniMap",
  "MiniMapNode",
  "NodeResizeControl",
  "NodeResizer",
  "NodeToolbar",
  "PanOnScrollMode",
  "Panel",
  "Position",
  "ResizeControlVariant",
  "SelectionMode",
  "SmoothStepEdge",
  "SolidFlow",
  "SolidFlowProvider",
  "StepEdge",
  "StraightEdge",
  "ViewportPortal",
  "addEdge",
  "connectionKey",
  "createEdgeStore",
  "createNodeStore",
  "createOptimisticEdgeStore",
  "createOptimisticNodeStore",
  "getBezierEdgeCenter",
  "getBezierPath",
  "getConnectedEdges",
  "getEdgeCenter",
  "getIncomers",
  "getNodesBounds",
  "getOutgoers",
  "getSmoothStepPath",
  "getStraightPath",
  "getViewportForBounds",
  "useConnection",
  "useEdge",
  "useEdgeId",
  "useEdges",
  "useInternalNode",
  "useKeyPress",
  "useNode",
  "useNodeConnections",
  "useNodeId",
  "useNodes",
  "useNodesData",
  "useNodesInitialized",
  "useOnSelectionChange",
  "useSelectedEdges",
  "useSelectedNodes",
  "useSolidFlow",
  "useUpdateNodeInternals",
  "useViewport",
  "useViewportInitialized",
];

// The reactive struct `useSolidFlow().flow` exposes, pinned the same way.
// Row records the flow derives for its own renderers stay internal (as in
// React Flow and Svelte Flow); `internalNodes` is public (useInternalNode).
const PUBLIC_FLOW_KEYS = [
  "nodes",
  "edges",
  "internalNodes",
  "connections",
  "selection",
  "nodesInitialized",
  "viewportInitialized",
  "viewport",
  "width",
  "height",
  "connection",
  "dragging",
  "minZoom",
  "maxZoom",
  "nodesDraggable",
  "nodesConnectable",
  "elementsSelectable",
  "snapGrid",
];

describe("public surface", () => {
  it("exports exactly the public runtime API", () => {
    expect(Object.keys(api).sort()).toEqual([...PUBLIC_RUNTIME_EXPORTS].sort());
  });

  it("useSolidFlow().flow exposes exactly the public flow struct", () => {
    let keys: string[] = [];
    const Probe = () => ((keys = Object.keys(api.useSolidFlow().flow)), null);
    render(() => (
      <api.SolidFlow nodes={[]} edges={[]} width={100} height={100}>
        <Probe />
      </api.SolidFlow>
    ));
    expect(keys.sort()).toEqual([...PUBLIC_FLOW_KEYS].sort());
  });
});
