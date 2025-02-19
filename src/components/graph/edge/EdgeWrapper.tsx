import { getMarkerId } from "@xyflow/system";
import clsx from "clsx";
import { type Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { useFlowStore } from "@/components/contexts";
import { EdgeIdContext } from "@/components/contexts/edgeId";
import type { EdgeComponentKey } from "@/data/types";
import { useHandleEdgeSelect } from "@/hooks/useHandleEdgeSelect";
import type { EdgeEventCallbacks, EdgeLayouted } from "@/shared/types";

import { BezierEdgeInternal } from ".";

export type EdgeWrapperProps = EdgeLayouted & Partial<EdgeEventCallbacks>;

const EdgeWrapper: Component<EdgeWrapperProps> = (props) => {
  const { store } = useFlowStore();
  const handleEdgeSelect = useHandleEdgeSelect();

  // Computed values
  const edgeType = () => (props.type || "default") as EdgeComponentKey;
  const edgeComponent = () => store.edgeTypes[edgeType()] || BezierEdgeInternal;
  const markerStartUrl = () =>
    props.markerStart ? `url('#${getMarkerId(props.markerStart, store.id)}')` : undefined;
  const markerEndUrl = () =>
    props.markerEnd ? `url('#${getMarkerId(props.markerEnd, store.id)}')` : undefined;
  const isSelectable = () => props.selectable ?? store.elementsSelectable;

  const onClick = (event: MouseEvent | TouchEvent) => {
    const edge = store.edgeLookup.get(props.id);

    if (edge) {
      handleEdgeSelect(props.id);
      props.onEdgeClick?.(edge, event);
    }
  };

  const onMouseEvent = (event: MouseEvent, type: "contextmenu" | "mouseenter" | "mouseleave") => {
    const edge = store.edgeLookup.get(props.id);

    if (!edge) return;

    const handlers = {
      contextmenu: props.onEdgeContextMenu,
      mouseenter: props.onEdgeMouseEnter,
      mouseleave: props.onEdgeMouseLeave,
    } as const;

    handlers[type]?.(edge, event);
  };

  const idValue = () => props.id;

  return (
    <EdgeIdContext.Provider value={idValue}>
      <Show when={!props.hidden}>
        <svg style={{ "z-index": props.zIndex }}>
          <g
            class={clsx(["solid-flow__edge", props.class])}
            classList={{
              animated: props.animated,
              selected: props.selected,
              selectable: isSelectable(),
            }}
            data-id={props.id}
            onClick={onClick}
            onContextMenu={(e) => onMouseEvent(e, "contextmenu")}
            onMouseEnter={(e) => onMouseEvent(e, "mouseenter")}
            onMouseLeave={(e) => onMouseEvent(e, "mouseleave")}
            aria-label={
              props.ariaLabel === null
                ? undefined
                : props.ariaLabel
                  ? props.ariaLabel
                  : `Edge from ${props.source} to ${props.target}`
            }
            role="img"
          >
            <Dynamic
              component={edgeComponent()}
              id={props.id}
              source={props.source}
              target={props.target}
              sourceX={props.sourceX}
              sourceY={props.sourceY}
              targetX={props.targetX}
              targetY={props.targetY}
              sourcePosition={props.sourcePosition}
              targetPosition={props.targetPosition}
              animated={props.animated}
              selected={props.selected}
              label={props.label}
              labelStyle={props.labelStyle}
              data={props.data}
              style={props.style}
              interactionWidth={props.interactionWidth}
              sourceHandleId={props.sourceHandle}
              targetHandleId={props.targetHandle}
              deletable={props.deletable ?? true}
              selectable={isSelectable()}
              type={edgeType()}
              markerStart={markerStartUrl()}
              markerEnd={markerEndUrl()}
            />
          </g>
        </svg>
      </Show>
    </EdgeIdContext.Provider>
  );
};

export default EdgeWrapper;
