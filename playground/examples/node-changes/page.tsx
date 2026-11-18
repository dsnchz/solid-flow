import { createSignal } from "solid-js";

import {
  Background,
  createEdgeStore,
  createNodeStore,
  type NodeChangeset,
  type NodeProps,
  NodeResizer,
  Panel,
  SolidFlow,
} from "@/index";

const ResizableNode = (props: NodeProps<{ label: string }>) => (
  <>
    <NodeResizer visible={!!props.selected} />
    <div>{props.data.label}</div>
  </>
);

const nodeTypes = { resizable: ResizableNode };

// onNodesChange as a filter: the flow's own writes arrive as a changeset
// before they land. "Locked" never moves, "Kept" cannot be deleted, "Box"
// cannot grow wider than 200, and the panel lists the change types of the
// last changeset. e2e/node-changes.spec.ts drives it.
export const NodeChanges = () => {
  const [nodes] = createNodeStore<typeof nodeTypes>([
    { id: "locked", type: "default", data: { label: "Locked" }, position: { x: 0, y: 0 } },
    { id: "free", type: "default", data: { label: "Free" }, position: { x: 250, y: 0 } },
    { id: "kept", type: "default", data: { label: "Kept" }, position: { x: 125, y: 150 } },
    {
      id: "box",
      type: "resizable",
      data: { label: "Box" },
      position: { x: 300, y: 150 },
      width: 120,
      height: 60,
      style: { border: "1px solid #222" },
    },
  ]);
  const [edges] = createEdgeStore([{ id: "free-kept", source: "free", target: "kept" }]);
  const [lastTypes, setLastTypes] = createSignal("");

  const onNodesChange = (changes: NodeChangeset) => {
    setLastTypes([...new Set(changes.toArray().map((change) => change.type))].join(","));
    for (const change of changes.getForNode("locked")) {
      if (change.type === "position") changes.remove(change);
    }
    for (const change of changes.getForNode("kept")) {
      if (change.type === "remove") changes.remove(change);
    }
    for (const change of changes.getForNode("box")) {
      if (change.type === "dimensions" && (change.dimensions?.width ?? 0) > 200) {
        changes.removeForNode("box");
        break;
      }
    }
  };

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      fitView
    >
      <Background />
      <Panel position="top-left">
        <span data-testid="last-changes">{lastTypes()}</span>
      </Panel>
    </SolidFlow>
  );
};
