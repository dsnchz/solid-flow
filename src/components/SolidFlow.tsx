import type { JSX } from "@solidjs/web";
import { type ColorModeClass, infiniteExtent } from "@xyflow/system";
import {
  createEffect,
  createMemo,
  createSignal,
  merge,
  omit,
  onSettled,
  type ParentProps,
  untrack,
  useContext,
} from "solid-js";

import { createSolidFlow } from "@/browser/createSolidFlow";
import { ConnectionLine } from "@/components/connection";
import { EdgeRenderer, NodeRenderer, Pane, Viewport, Zoom } from "@/components/container";
import { NodeSelection, Selection } from "@/components/selection";
import { Attribution, KeyHandler } from "@/components/utility";
import { typedSolidFlowContext } from "@/contexts/flow";
import { getDefaultFlowStateProps } from "@/core/defaults";
import { FLOW_PROP_KEYS, type SolidFlowProps } from "@/core/flowProps";
import type { Edge, Node, PanOnScrollMode } from "@/types";
import { toPxString } from "@/utils";

import { A11yDescriptions } from "./accessibility";

type SolidFlowComponentProps<
  NodeType extends Node = Node,
  EdgeType extends Edge = Edge,
> = ParentProps<SolidFlowProps<NodeType, EdgeType>> &
  Omit<JSX.HTMLAttributes<HTMLDivElement>, "style" | "onselectionchange" | "onSelectionChange">;

/** The flow canvas component: renders nodes and edges and wires up viewport and interactions. */
export const SolidFlow = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: SolidFlowComponentProps<NodeType, EdgeType>,
): JSX.Element => {
  const [domNodeRef, setDomNodeRef] = createSignal<HTMLDivElement>();
  let domNode!: HTMLDivElement;

  const _props = merge(
    {
      ...getDefaultFlowStateProps(),
      colorMode: "light" as ColorModeClass,
      nodeClickDistance: 0,
      panOnScroll: false,
      preventScrolling: true,
      panOnDrag: true,
      panOnScrollSpeed: 0.5,
      panOnScrollMode: "free" as PanOnScrollMode,
      paneClickDistance: 0,
      selectionOnDrag: false,
      translateExtent: infiniteExtent,
      zoomOnPinch: true,
      zoomOnDoubleClick: true,
      zoomOnScroll: true,
    },
    props,
  );

  const htmlProps = omit(_props, ...FLOW_PROP_KEYS, "children");

  // In Solid 2.0 the context object IS the provider component (also used in
  // the JSX below); the generic retyping lives in typedSolidFlowContext.
  const TypedSolidFlowContext = typedSolidFlowContext<NodeType, EdgeType>();

  const solidFlow = useContext(TypedSolidFlowContext) ?? createSolidFlow(_props);
  const { store, actions } = solidFlow;

  onSettled(() => {
    actions.applyInitialFitView(_props.fitView);
    actions.setConfig(_props);
    actions.setDomNode(domNode);

    return () => {
      actions.reset();
    };
  });

  // Sync with the container's real size (external system: ResizeObserver)
  createEffect(
    () => domNodeRef(),
    (el) => {
      if (!el) return;
      const observer = new ResizeObserver(() => {
        actions.setWidth(el.clientWidth);
        actions.setHeight(el.clientHeight);
      });
      observer.observe(el);
      return () => observer.disconnect();
    },
  );

  // Fires only when the set of selected ids changes, not on unrelated node/edge updates
  const selectedElements = createMemo(
    () => ({ nodes: store.selectedNodes, edges: store.selectedEdges }),
    {
      equals: (a, b) =>
        a.nodes.length === b.nodes.length &&
        a.edges.length === b.edges.length &&
        a.nodes.every((node, i) => node.id === b.nodes[i]!.id) &&
        a.edges.every((edge, i) => edge.id === b.edges[i]!.id),
    },
  );

  // Any viewport change, programmatic included (React Flow onViewportChange
  // parity) — onMove and friends stay gesture-only.
  createEffect(
    () => ({ x: store.viewport.x, y: store.viewport.y, zoom: store.viewport.zoom }),
    (viewport, prev) => {
      if (prev) untrack(() => _props.onViewportChange)?.(viewport);
    },
  );

  createEffect(
    () => selectedElements(),
    (params) => {
      untrack(() => _props.onSelectionChange)?.(params);
    },
  );

  // Async-seed guard, rendered as a dynamic insert (returns null, shows
  // nothing). While an async-seeded nodes/edges store is unresolved, the
  // leaf reads throw NotReadyError, which reaches the user's <Loading>
  // boundary. It must read the COMPONENT props (the user's stores), not the
  // internal store: a provider-adopted flow's internal store is seeded
  // before these props exist and never carries their not-readiness (the
  // adoption effect just waits on it), and the flow's own reads happen
  // inside For and projections, which hold their empty initial values —
  // either way first-load pending state would silently render as an empty
  // graph. An opaque call, not an inline expression, so the compiler cannot
  // fold it away statically.
  const asyncSeedGuard = () => {
    void _props.nodes?.length;
    void _props.edges?.length;
    return null;
  };

  const rootStyle = (): JSX.CSSProperties => ({
    width: toPxString(_props.width),
    height: toPxString(_props.height),
    ..._props.style,
  });

  return (
    <div
      role="application"
      data-testid="solid-flow__wrapper"
      ref={(el) => {
        domNode = el;
        setDomNodeRef(el);
      }}
      class={[
        "solid-flow",
        "solid-flow__container",
        _props.class,
        store.colorMode,
        // Connection-gesture state as ROOT classes (perf P2): the handles'
        // possible-target affordance derives from these in CSS, so starting
        // a gesture touches this one element instead of every handle.
        {
          connecting: !!store.connectionFromHandle || !!store.clickConnectStartHandle,
          "connecting-from-source":
            (store.connectionFromHandle ?? store.clickConnectStartHandle)?.type === "source",
          "connecting-from-target":
            (store.connectionFromHandle ?? store.clickConnectStartHandle)?.type === "target",
          "connection-strict": store.connectionMode === "strict",
        },
      ]}
      style={rootStyle()}
      onScroll={(e) => {
        e.currentTarget.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }}
      {...htmlProps}
    >
      <TypedSolidFlowContext value={solidFlow}>
        {asyncSeedGuard()}
        <KeyHandler
          selectionKey={_props.selectionKey}
          deleteKey={_props.deleteKey}
          panActivationKey={_props.panActivationKey}
          multiSelectionKey={_props.multiSelectionKey}
          zoomActivationKey={_props.zoomActivationKey}
        />
        <Zoom
          panOnScrollMode={_props.panOnScrollMode}
          preventScrolling={_props.preventScrolling}
          zoomOnScroll={_props.zoomOnScroll}
          zoomOnDoubleClick={_props.zoomOnDoubleClick}
          zoomOnPinch={_props.zoomOnPinch}
          panOnScroll={_props.panOnScroll}
          panOnScrollSpeed={_props.panOnScrollSpeed}
          panOnDrag={_props.panOnDrag}
          paneClickDistance={_props.paneClickDistance}
          selectionOnDrag={_props.selectionOnDrag}
          onMoveStart={_props.onMoveStart}
          onMove={_props.onMove}
          onMoveEnd={_props.onMoveEnd}
          onViewportInitialized={_props.onInit}
          initialViewport={_props.viewport || _props.initialViewport}
        >
          <Pane
            onPaneClick={_props.onPaneClick}
            onPaneContextMenu={_props.onPaneContextMenu}
            onPaneScroll={_props.onPaneScroll}
            onPanePointerEnter={_props.onPanePointerEnter}
            onPanePointerMove={_props.onPanePointerMove}
            onPanePointerLeave={_props.onPanePointerLeave}
            onSelectionStart={_props.onSelectionStart}
            onSelectionEnd={_props.onSelectionEnd}
            panOnDrag={_props.panOnDrag}
            selectionOnDrag={_props.selectionOnDrag}
            paneClickDistance={_props.paneClickDistance}
            autoPanOnSelection={_props.autoPanOnSelection}
          >
            <Viewport>
              <div class="solid-flow__container solid-flow__viewport-back" />
              <EdgeRenderer<NodeType, EdgeType>
                onEdgeClick={_props.onEdgeClick}
                onEdgeContextMenu={_props.onEdgeContextMenu}
                onEdgePointerEnter={_props.onEdgePointerEnter}
                onEdgePointerLeave={_props.onEdgePointerLeave}
                onEdgePointerMove={_props.onEdgePointerMove}
                onEdgeDoubleClick={_props.onEdgeDoubleClick}
              />
              <div class="solid-flow__container solid-flow__edge-labels" />
              <ConnectionLine<NodeType>
                type={_props.connectionLineType}
                component={_props.connectionLineComponent}
                containerStyle={_props.connectionLineContainerStyle}
                style={_props.connectionLineStyle}
              />
              <NodeRenderer
                nodeClickDistance={_props.nodeClickDistance}
                onNodeClick={_props.onNodeClick}
                onNodeDoubleClick={_props.onNodeDoubleClick}
                onNodeContextMenu={_props.onNodeContextMenu}
                onNodePointerEnter={_props.onNodePointerEnter}
                onNodePointerMove={_props.onNodePointerMove}
                onNodePointerLeave={_props.onNodePointerLeave}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDragStop={_props.onNodeDragStop}
              />
              <NodeSelection
                onSelectionClick={_props.onSelectionClick}
                onSelectionContextMenu={_props.onSelectionContextMenu}
                onNodeDrag={_props.onNodeDrag}
                onNodeDragStart={_props.onNodeDragStart}
                onNodeDragStop={_props.onNodeDragStop}
              />
            </Viewport>
            <Selection
              isVisible={!!store.selectionRect && store.selectionRectMode === "user"}
              width={store.selectionRect?.width}
              height={store.selectionRect?.height}
              x={store.selectionRect?.x}
              y={store.selectionRect?.y}
            />
          </Pane>
        </Zoom>
        <Attribution proOptions={_props.proOptions} position={_props.attributionPosition} />
        <A11yDescriptions />
        {_props.children}
      </TypedSolidFlowContext>
    </div>
  );
};
