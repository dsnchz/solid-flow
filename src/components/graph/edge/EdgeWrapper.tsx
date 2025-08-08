import { elementSelectionKeys, getMarkerId } from "@xyflow/system";
import clsx from "clsx";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { ARIA_EDGE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/components/contexts";
import { EdgeIdContext } from "@/components/contexts/edgeId";
import type { Edge, EdgeEvents, Node } from "@/types";

export type EdgeWrapperProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType> & {
  readonly edgeId: string;
};

export const EdgeWrapper = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeWrapperProps<EdgeType>,
) => {
  let edgeRef!: SVGGElement;
  const { store, actions } = useInternalSolidFlow<NodeType, EdgeType>();

  const edgeId = () => props.edgeId;
  const edge = () => actions.getEdge(edgeId())!;

  const edgeType = () => edge().type ?? "default";
  const selectable = () => edge().selectable ?? store.elementsSelectable;
  const focusable = () => edge().focusable ?? store.edgesFocusable;

  const edgeComponent = () => store.edgeTypes[edgeType()];

  const markerStartUrl = () =>
    edge().markerStart ? `url('#${getMarkerId(edge().markerStart, store.id)}')` : undefined;

  const markerEndUrl = () =>
    edge().markerEnd ? `url('#${getMarkerId(edge().markerEnd, store.id)}')` : undefined;

  const onClick = (event: MouseEvent) => {
    if (selectable()) {
      actions.handleEdgeSelection(edgeId());
    }
    props.onEdgeClick?.({ edge: edge(), event });
  };

  const onPointerEvent = <T extends PointerEvent>(
    event: T,
    type: "contextmenu" | "pointerenter" | "pointerleave",
  ) => {
    const handlers = {
      contextmenu: props.onEdgeContextMenu,
      pointerenter: props.onEdgePointerEnter,
      pointerleave: props.onEdgePointerLeave,
    } as const;

    handlers[type]?.({ edge: edge(), event });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (store.disableKeyboardA11y || !elementSelectionKeys.includes(event.key) || !selectable()) {
      return;
    }

    const unselect = event.key === "Escape";

    if (unselect) {
      edgeRef?.blur();
      actions.unselectNodesAndEdges({ edges: [edge()] });
    } else {
      actions.addSelectedEdges([edge().id]);
    }
  };

  const ariaLabel = () => edge().ariaLabel ?? `Edge from ${edge().source} to ${edge().target}`;

  return (
    <EdgeIdContext.Provider value={edgeId}>
      <Show when={!edge().hidden}>
        <svg class="solid-flow__edge-wrapper" style={{ "z-index": edge().zIndex }}>
          <g
            ref={edgeRef}
            data-id={edge().id}
            tabIndex={focusable() ? 0 : undefined}
            role={edge().ariaRole ?? (focusable() ? "group" : "img")}
            aria-label={ariaLabel()}
            aria-roledescription="edge"
            aria-describedby={focusable() ? `${ARIA_EDGE_DESC_KEY}-${store.id}` : undefined}
            class={clsx(
              "solid-flow__edge",
              edgeType(),
              {
                animated: edge().animated,
                selected: edge().selected,
                selectable: selectable(),
              },
              edge().class,
            )}
            onClick={onClick}
            onKeyDown={(e) => focusable() && onKeyDown(e)}
            onContextMenu={(e) => onPointerEvent(e, "contextmenu")}
            onPointerEnter={(e) => onPointerEvent(e, "pointerenter")}
            onPointerLeave={(e) => onPointerEvent(e, "pointerleave")}
            {...edge().domAttributes}
          >
            <Dynamic
              component={edgeComponent()}
              id={edge().id}
              source={edge().source}
              target={edge().target}
              sourceX={edge().sourceX}
              sourceY={edge().sourceY}
              targetX={edge().targetX}
              targetY={edge().targetY}
              sourcePosition={edge().sourcePosition}
              targetPosition={edge().targetPosition}
              animated={edge().animated}
              selected={edge().selected}
              label={edge().label}
              labelStyle={edge().labelStyle}
              data={edge().data}
              style={edge().style}
              interactionWidth={edge().interactionWidth}
              selectable={selectable()}
              deletable={edge().deletable ?? true}
              type={edgeType()}
              sourceHandleId={edge().sourceHandle}
              targetHandleId={edge().targetHandle}
              markerStart={markerStartUrl()}
              markerEnd={markerEndUrl()}
            />
          </g>
        </svg>
      </Show>
    </EdgeIdContext.Provider>
  );
};
