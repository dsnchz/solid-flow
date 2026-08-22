import { createSignal } from "solid-js";

import {
  Controls,
  createEdgeStore,
  createNodeStore,
  MiniMap,
  Panel,
  PanOnScrollMode,
  SolidFlow,
} from "@/index";

export const Interaction = () => {
  const [nodes] = createNodeStore([
    {
      id: "1",
      type: "input",
      data: { label: "Node 1" },
      position: { x: 250, y: 5 },
    },
    {
      id: "2",
      type: "default",
      data: { label: "Node 2" },
      position: { x: 100, y: 100 },
    },
    {
      id: "3",
      type: "default",
      data: { label: "Node 3" },
      position: { x: 400, y: 100 },
    },
    {
      id: "4",
      type: "default",
      data: { label: "Node 4" },
      position: { x: 400, y: 200 },
    },
  ]);

  const [edges] = createEdgeStore([
    {
      id: "e1-2",
      source: "1",
      target: "2",
      animated: true,
    },
    {
      id: "e1-3",
      source: "1",
      target: "3",
    },
  ]);

  // Interactive state
  const [isSelectable, setIsSelectable] = createSignal(false);
  const [isDraggable, setIsDraggable] = createSignal(false);
  const [isConnectable, setIsConnectable] = createSignal(false);
  const [zoomOnScroll, setZoomOnScroll] = createSignal(false);
  const [zoomOnPinch, setZoomOnPinch] = createSignal(false);
  const [panOnScroll, setPanOnScroll] = createSignal(false);
  const [panOnScrollMode, setPanOnScrollMode] = createSignal<PanOnScrollMode>(PanOnScrollMode.Free);
  const [zoomOnDoubleClick, setZoomOnDoubleClick] = createSignal(false);
  const [panOnDrag, setPanOnDrag] = createSignal(true);
  const [captureZoomClick, setCaptureZoomClick] = createSignal(false);
  const [captureZoomScroll, setCaptureZoomScroll] = createSignal(false);
  const [captureElementClick, setCaptureElementClick] = createSignal(false);

  return (
    <SolidFlow
      nodes={nodes}
      edges={edges}
      elementsSelectable={isSelectable()}
      nodesConnectable={isConnectable()}
      nodesDraggable={isDraggable()}
      zoomOnScroll={zoomOnScroll()}
      zoomOnPinch={zoomOnPinch()}
      panOnScroll={panOnScroll()}
      panOnScrollMode={panOnScrollMode()}
      zoomOnDoubleClick={zoomOnDoubleClick()}
      panOnDrag={panOnDrag()}
      onNodeDragStart={({ targetNode, event }) => console.log("drag start", targetNode, event)}
      onNodeDragStop={({ targetNode, event }) => console.log("drag stop", targetNode, event)}
      onNodeClick={({ node, event }) => console.log("click", node, event)}
      onEdgeClick={({ edge, event }) => console.log("click", edge, event)}
      onPaneClick={({ event }) => console.log("onPaneClick", event)}
      onPaneContextMenu={({ event }) => console.log("onPaneContextMenu", event)}
      onMoveEnd={(_, viewport) => console.log("onMoveEnd", viewport)}
      fitView
    >
      <MiniMap />
      <Controls />

      <Panel position="top-right">
        <div>
          <label for="draggable">
            nodesDraggable
            <input
              id="draggable"
              type="checkbox"
              checked={isDraggable()}
              onChange={(e) => setIsDraggable(e.target.checked)}
              class="solid-flow__draggable"
            />
          </label>
        </div>
        <div>
          <label for="connectable">
            nodesConnectable
            <input
              id="connectable"
              type="checkbox"
              checked={isConnectable()}
              onChange={(e) => setIsConnectable(e.target.checked)}
              class="solid-flow__connectable"
            />
          </label>
        </div>
        <div>
          <label for="selectable">
            elementsSelectable
            <input
              id="selectable"
              type="checkbox"
              checked={isSelectable()}
              onChange={(e) => setIsSelectable(e.target.checked)}
              class="solid-flow__selectable"
            />
          </label>
        </div>
        <div>
          <label for="zoomonscroll">
            zoomOnScroll
            <input
              id="zoomonscroll"
              type="checkbox"
              checked={zoomOnScroll()}
              onChange={(e) => setZoomOnScroll(e.target.checked)}
              class="solid-flow__zoomonscroll"
            />
          </label>
        </div>
        <div>
          <label for="zoomonpinch">
            zoomOnPinch
            <input
              id="zoomonpinch"
              type="checkbox"
              checked={zoomOnPinch()}
              onChange={(e) => setZoomOnPinch(e.target.checked)}
              class="solid-flow__zoomonpinch"
            />
          </label>
        </div>
        <div>
          <label for="panonscroll">
            panOnScroll
            <input
              id="panonscroll"
              type="checkbox"
              checked={panOnScroll()}
              onChange={(e) => setPanOnScroll(e.target.checked)}
              class="solid-flow__panonscroll"
            />
          </label>
        </div>
        <div>
          <label for="panonscrollmode">
            panOnScrollMode
            <select
              id="panonscrollmode"
              value={panOnScrollMode()}
              onChange={(e) => setPanOnScrollMode(e.target.value as PanOnScrollMode)}
              class="solid-flow__panonscrollmode"
            >
              <option value="free">free</option>
              <option value="horizontal">horizontal</option>
              <option value="vertical">vertical</option>
            </select>
          </label>
        </div>
        <div>
          <label for="zoomondbl">
            zoomOnDoubleClick
            <input
              id="zoomondbl"
              type="checkbox"
              checked={zoomOnDoubleClick()}
              onChange={(e) => setZoomOnDoubleClick(e.target.checked)}
              class="solid-flow__zoomondbl"
            />
          </label>
        </div>
        <div>
          <label for="panondrag">
            panOnDrag
            <input
              id="panondrag"
              type="checkbox"
              checked={panOnDrag()}
              onChange={(e) => setPanOnDrag(e.target.checked)}
              class="solid-flow__panondrag"
            />
          </label>
        </div>
        <div>
          <label for="capturezoompaneclick">
            capture onPaneClick
            <input
              id="capturezoompaneclick"
              type="checkbox"
              checked={captureZoomClick()}
              onChange={(e) => setCaptureZoomClick(e.target.checked)}
              class="solid-flow__capturezoompaneclick"
            />
          </label>
        </div>
        <div>
          <label for="capturezoompanescroll">
            capture onPaneScroll
            <input
              id="capturezoompanescroll"
              type="checkbox"
              checked={captureZoomScroll()}
              onChange={(e) => setCaptureZoomScroll(e.target.checked)}
              class="solid-flow__capturezoompanescroll"
            />
          </label>
        </div>
        <div>
          <label for="captureelementclick">
            capture onElementClick
            <input
              id="captureelementclick"
              type="checkbox"
              checked={captureElementClick()}
              onChange={(e) => setCaptureElementClick(e.target.checked)}
              class="solid-flow__captureelementclick"
            />
          </label>
        </div>
      </Panel>
    </SolidFlow>
  );
};
