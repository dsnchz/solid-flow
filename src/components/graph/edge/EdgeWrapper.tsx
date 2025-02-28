import { getMarkerId } from "@xyflow/system";
import clsx from "clsx";
import { createSignal, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { useFlowStore } from "@/components/contexts";
import { EdgeIdContext } from "@/components/contexts/edgeId";
import type { SolidFlowProps } from "@/components/SolidFlow/types";
import { useHandleEdgeSelect } from "@/hooks/useHandleEdgeSelect";
import type { Edge, EdgeEventCallbacks, EdgeLayouted, Node } from "@/shared/types";
import type { MouseOrTouchEvent } from "@/shared/types/events";

import { BezierEdgeInternal } from ".";
import { EdgeUpdateAnchors } from "./EdgeUpdateAnchors";

export type EdgeWrapperProps<NodeType extends Node = Node, EdgeType extends Edge = Edge> = Partial<
  EdgeEventCallbacks<EdgeType>
> &
  Pick<SolidFlowProps<NodeType, EdgeType>, "reconnectRadius"> & {
    readonly edge: EdgeLayouted;
  };

const EdgeWrapper = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeWrapperProps<NodeType, EdgeType>,
) => {
  const { store } = useFlowStore<NodeType, EdgeType>();
  const handleEdgeSelect = useHandleEdgeSelect();

  const [updateHover, setUpdateHover] = createSignal(false);
  const [reconnecting, setReconnecting] = createSignal(false);

  // Computed values
  const storedEdge = () => store.edgeLookup.get(props.edge.id)!;
  const edgeType = () => props.edge.type ?? "default";
  const edgeId = () => storedEdge().id;

  const isSelectable = () => props.edge.selectable ?? store.elementsSelectable;
  const edgeComponent = () => store.edgeTypes[edgeType()] || BezierEdgeInternal;

  const isReconnectable = () =>
    Boolean(
      props.onEdgeReconnect &&
        (storedEdge().reconnectable ||
          (storedEdge().reconnectable && typeof storedEdge().reconnectable === "undefined")),
    );

  const isFocusable = () =>
    Boolean(
      storedEdge().focusable ||
        (props.edge.focusable && typeof storedEdge().focusable === "undefined"),
    );

  const markerStartUrl = () =>
    props.edge.markerStart
      ? `url('#${getMarkerId(storedEdge().markerStart, store.id)}')`
      : undefined;
  const markerEndUrl = () =>
    props.edge.markerEnd ? `url('#${getMarkerId(storedEdge().markerEnd, store.id)}')` : undefined;

  const onClick = (event: MouseOrTouchEvent) => {
    const edge = storedEdge();

    if (!edge) return;

    handleEdgeSelect(storedEdge().id);
    props.onEdgeClick?.(storedEdge(), event);
  };

  const onMouseEvent = (event: MouseEvent, type: "contextmenu" | "mouseenter" | "mouseleave") => {
    const edge = storedEdge();

    if (!edge) return;

    const handlers = {
      contextmenu: props.onEdgeContextMenu,
      mouseenter: props.onEdgeMouseEnter,
      mouseleave: props.onEdgeMouseLeave,
    } as const;

    handlers[type]?.(edge, event);
  };

  // const onKeyDown = (event: KeyboardEvent) => {
  //   if (!disableKeyboardA11y && elementSelectionKeys.includes(event.key) && isSelectable) {
  //     const { unselectNodesAndEdges, addSelectedEdges } = store.getState();
  //     const unselect = event.key === 'Escape';

  //     if (unselect) {
  //       edge().blur();
  //       unselectNodesAndEdges({ edges: [edge] });
  //     } else {
  //       addSelectedEdges([id]);
  //     }
  //   }
  // };

  const ariaLabel = () =>
    storedEdge().ariaLabel ?? `Edge from ${storedEdge().source} to ${storedEdge().target}`;

  return (
    <EdgeIdContext.Provider value={edgeId}>
      <Show when={!props.edge.hidden}>
        <svg style={{ "z-index": props.edge.zIndex }}>
          <g
            role={isFocusable() ? "button" : "img"}
            data-id={props.edge.id}
            onClick={onClick}
            onContextMenu={(e) => onMouseEvent(e, "contextmenu")}
            onMouseEnter={(e) => onMouseEvent(e, "mouseenter")}
            onMouseLeave={(e) => onMouseEvent(e, "mouseleave")}
            tabIndex={isFocusable() ? 0 : undefined}
            aria-label={ariaLabel()}
            class={clsx(
              "solid-flow__edge",
              edgeType(),
              {
                animated: props.edge.animated,
                selected: props.edge.selected,
                selectable: isSelectable(),
                updating: updateHover(),
              },
              props.edge.class,
            )}
          >
            <Show when={!reconnecting()}>
              <Dynamic
                component={edgeComponent()}
                id={props.edge.id}
                source={props.edge.source}
                target={props.edge.target}
                sourceX={props.edge.sourceX}
                sourceY={props.edge.sourceY}
                targetX={props.edge.targetX}
                targetY={props.edge.targetY}
                sourcePosition={props.edge.sourcePosition}
                targetPosition={props.edge.targetPosition}
                animated={props.edge.animated}
                selected={props.edge.selected}
                label={props.edge.label}
                labelStyle={props.edge.labelStyle}
                data={props.edge.data}
                style={props.edge.style}
                interactionWidth={props.edge.interactionWidth}
                sourceHandleId={props.edge.sourceHandle}
                targetHandleId={props.edge.targetHandle}
                deletable={props.edge.deletable ?? true}
                selectable={isSelectable()}
                type={edgeType()}
                markerStart={markerStartUrl()}
                markerEnd={markerEndUrl()}
              />
            </Show>
            <Show when={isReconnectable()}>
              <EdgeUpdateAnchors<EdgeType>
                edge={storedEdge()}
                isReconnectable={isReconnectable()}
                reconnectRadius={props.reconnectRadius}
                onEdgeReconnect={props.onEdgeReconnect}
                onEdgeReconnectStart={props.onEdgeReconnectStart}
                onEdgeReconnectEnd={props.onEdgeReconnectEnd}
                sourceX={props.edge.sourceX}
                sourceY={props.edge.sourceY}
                targetX={props.edge.targetX}
                targetY={props.edge.targetY}
                sourcePosition={props.edge.sourcePosition}
                targetPosition={props.edge.targetPosition}
                setUpdateHover={setUpdateHover}
                setReconnecting={setReconnecting}
              />
            </Show>
          </g>
        </svg>
      </Show>
    </EdgeIdContext.Provider>
  );
};

export default EdgeWrapper;
