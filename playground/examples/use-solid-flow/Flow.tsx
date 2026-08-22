import { For } from "solid-js";

import { useEdges, useNodes, useSolidFlow, useViewport } from "@/index";

export const Flow = () => {
  const {
    zoomIn,
    zoomOut,
    setZoom,
    fitView,
    setCenter,
    setViewport,
    getViewport,
    toObject,
    deleteElements,
  } = useSolidFlow();

  const nodes = useNodes();
  const edges = useEdges();
  const viewport = useViewport();

  const deleteNode = () => {
    const currentNodes = nodes();
    if (currentNodes.length > 0) {
      void deleteElements({ nodes: [{ id: currentNodes[0]!.id }] });
    }
  };

  return (
    <aside
      style={{
        width: "20vw",
        background: "#f4f4f4",
        padding: "0.4rem 0.8rem",
        "font-size": "12px",
      }}
    >
      <div class="label" style={{ "font-weight": "700", margin: "0.5rem 0 0.25rem 0" }}>
        Functions:
      </div>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => zoomIn()}
      >
        zoom in
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => zoomOut({ duration: 1000 })}
      >
        zoom out transition
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => setZoom(2)}
      >
        set zoom
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => fitView({ duration: 600 })}
      >
        fitView
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => setCenter(0, 0)}
      >
        setCenter 0, 0
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => setViewport({ x: 100, y: 100, zoom: 2 })}
      >
        setViewport
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => console.log(getViewport())}
      >
        getViewport
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => void deleteElements({ edges: edges().map((edge) => ({ id: edge.id })) })}
      >
        delete edges
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => deleteNode()}
      >
        delete node
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => void deleteElements({ nodes: nodes().map((node) => ({ id: node.id })) })}
      >
        deleteElements
      </button>
      <button
        style={{ display: "block", "margin-bottom": "0.5rem", "font-size": "12px" }}
        onClick={() => {
          const { nodes, edges, viewport } = toObject();
          console.log(nodes, edges, viewport);
        }}
      >
        toObject
      </button>

      <div class="label" style={{ "font-weight": "700", margin: "0.5rem 0 0.25rem 0" }}>
        Nodes:
      </div>
      <For each={nodes()}>
        {(node) => (
          <div>
            id: {node.id} | x: {node.position.x.toFixed(1)} y: {node.position.y.toFixed(1)}
          </div>
        )}
      </For>

      <div class="label" style={{ "font-weight": "700", margin: "0.5rem 0 0.25rem 0" }}>
        Viewport:
      </div>
      <div>
        x: {viewport().x.toFixed(1)} y: {viewport().y.toFixed(1)} zoom: {viewport().zoom.toFixed(1)}
      </div>
    </aside>
  );
};
