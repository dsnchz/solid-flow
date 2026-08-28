import { createEventListener } from "@solid-primitives/event-listener";
import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { elementSelectionKeys, errorMessages, getMarkerId } from "@xyflow/system";
import { createEffect, createMemo, createSignal, Show } from "solid-js";

import { ARIA_EDGE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/contexts";
import { EdgeIdContext } from "@/contexts/edgeId";
import { isEdgeCulled } from "@/core";
import type { Edge, EdgeEvents, Node } from "@/types";
import { emitFlowError, isEdgeSelectable } from "@/utils";

export type EdgeWrapperProps<EdgeType extends Edge = Edge> = EdgeEvents<EdgeType> & {
  readonly edgeId: string;
};

/** Internal per-edge wrapper: interaction, a11y, viewport culling, and the dynamic edge component. */
export const EdgeWrapper = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeWrapperProps<EdgeType>,
): JSX.Element => {
  let edgeRef!: SVGGElement;
  const [edgeEl, setEdgeEl] = createSignal<SVGGElement>();
  const { store, actions } = useInternalSolidFlow<NodeType, EdgeType>();

  const edgeId = () => props.edgeId;
  const edge = () => actions.getLayoutedEdge(edgeId())!;

  const edgeType = () => edge().type ?? "default";
  const selectable = () => isEdgeSelectable(edge(), store);
  const focusable = () => edge().focusable ?? store.edgesFocusable;

  const edgeTypeValid = () => edgeType() in store.edgeTypes;
  // Upstream parity (error011): unknown types render the default component
  // instead of nothing, and report through the error channel (mirrors
  // NodeWrapper's error003 effect).
  const edgeComponent = () => store.edgeTypes[edgeTypeValid() ? edgeType() : "default"];

  createEffect(
    () => ({ valid: edgeTypeValid(), edgeType: edgeType() }),
    ({ valid, edgeType }) => {
      if (!valid) {
        emitFlowError(store.onError, "011", errorMessages["error011"](edgeType));
      }
    },
  );

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

  // B8 (audit): direct handlers, matching NodeWrapper — the previous shape
  // rebuilt a handler map on every pointer event.
  const onContextMenu = (event: PointerEvent) => props.onEdgeContextMenu?.({ edge: edge(), event });
  const onPointerEnter = (event: PointerEvent) =>
    props.onEdgePointerEnter?.({ edge: edge(), event });
  const onPointerLeave = (event: PointerEvent) =>
    props.onEdgePointerLeave?.({ edge: edge(), event });
  const onPointerMove = (event: PointerEvent) => props.onEdgePointerMove?.({ edge: edge(), event });
  // The native compiler's delegated `dblclick` never fires (and `on:` is not
  // implemented in the AST-native milestone), so attach directly. The target
  // must be a SIGNAL: the <g> mounts after layout, later than this effect's
  // first run, and a plain ref never re-triggers the attach.
  const onDblClick = (event: MouseEvent) => props.onEdgeDoubleClick?.({ edge: edge(), event });
  createEventListener(edgeEl, "dblclick", onDblClick);

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

  // #15 culling flag: the drawn segment's AABB against the quantized culling
  // viewport. CSS-only — the edge row and its subscriptions stay live.
  const culled = createMemo(() => isEdgeCulled(edge(), store.cullingViewport));

  return (
    <EdgeIdContext value={edgeId}>
      <Show when={!edge().hidden}>
        <svg
          class="solid-flow__edge-wrapper"
          style={{
            "z-index": edge().zIndex,
            visibility: culled() ? "hidden" : undefined,
            "pointer-events": culled() ? "none" : undefined,
          }}
        >
          <g
            ref={(el) => {
              edgeRef = el;
              setEdgeEl(el);
            }}
            data-id={edge().id}
            tabindex={focusable() ? 0 : undefined}
            role={edge().ariaRole ?? (focusable() ? "group" : "img")}
            aria-label={ariaLabel()}
            aria-roledescription="edge"
            aria-describedby={focusable() ? `${ARIA_EDGE_DESC_KEY}-${store.id}` : undefined}
            class={[
              "solid-flow__edge",
              `solid-flow__edge-${edgeType()}`,
              {
                animated: !!edge().animated,
                selected: !!edge().selected,
                selectable: !!selectable(),
              },
              edge().class,
            ]}
            onClick={onClick}
            onKeyDown={(e) => focusable() && onKeyDown(e)}
            onContextMenu={onContextMenu}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
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
    </EdgeIdContext>
  );
};
