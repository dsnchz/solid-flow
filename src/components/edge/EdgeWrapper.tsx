import { createEventListener } from "@solid-primitives/event-listener";
import type { JSX } from "@solidjs/web";
import { dynamic } from "@solidjs/web";
import { elementSelectionKeys, getMarkerId } from "@xyflow/system";
import { type Accessor, createMemo, getOwner, runWithOwner, untrack } from "solid-js";

import { ARIA_EDGE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/contexts";
import { EdgeIdContext } from "@/contexts/edgeId";
import { edgeCulled } from "@/core";
import type { Edge, EdgeEvents, EdgeLayouted, Node } from "@/types";
import { clientOnlySetup, cx, isEdgeSelectable, spreadOnDemand } from "@/utils";

export type EdgeWrapperProps<EdgeType extends Edge = Edge> = {
  /** The flow's edge event handlers as ONE reference (see NodeWrapper, audit C10). */
  readonly events: EdgeEvents<EdgeType>;
  /** The layouted row, as EdgeRenderer's Show narrows it (one resolution per row). */
  readonly edge: Accessor<EdgeLayouted<EdgeType>>;
};

/** Internal per-edge wrapper: interaction, a11y, viewport culling, and the dynamic edge component. */
export const EdgeWrapper = <NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  props: EdgeWrapperProps<EdgeType>,
): JSX.Element => {
  let edgeRef!: SVGGElement;
  const { store, actions, onScreenEdgeIds } = useInternalSolidFlow<NodeType, EdgeType>();
  // The ref callback runs outside the component owner; the domAttributes
  // spread effects must be owned (disposal + no NO_OWNER diagnostics).
  const owner = getOwner();

  // ONE row resolution per row (see NodeWrapper): EdgeRenderer's Show
  // narrows getLayoutedEdge (which probes `in` first, so the row survives
  // while its endpoints are unmeasured) and hands the accessor down. Read
  // once: the accessor is stable.
  const edge = untrack(() => props.edge);
  const edgeId = () => edge().id;

  const edgeType = () => edge().type ?? "default";
  const selectable = () => isEdgeSelectable(edge(), store);
  const focusable = () => edge().focusable ?? store.edgesFocusable;

  const edgeTypeValid = () => edgeType() in store.edgeTypes;
  // Unknown types render the default component, silently (Svelte Flow
  // parity, 1.x and 2.0; nodes report error003). A per-edge effect only for
  // the report cost ~45 ms of a 10k mount and ~2 MB (audit C8).
  const edgeComponent = () => store.edgeTypes[edgeTypeValid() ? edgeType() : "default"];
  // `dynamic()` directly (see NodeWrapper): no per-row prop re-copy.
  const EdgeComponent = dynamic(edgeComponent);

  const markerStartUrl = () =>
    edge().markerStart ? `url('#${getMarkerId(edge().markerStart, store.id)}')` : undefined;

  const markerEndUrl = () =>
    edge().markerEnd ? `url('#${getMarkerId(edge().markerEnd, store.id)}')` : undefined;

  const onClick = (event: MouseEvent) => {
    if (selectable()) {
      actions.handleEdgeSelection(edgeId());
    }
    props.events.onEdgeClick?.({ edge: edge(), event });
  };

  // B8 (audit): direct handlers, matching NodeWrapper — the previous shape
  // rebuilt a handler map on every pointer event.
  const onContextMenu = (event: PointerEvent) =>
    props.events.onEdgeContextMenu?.({ edge: edge(), event });
  const onPointerEnter = (event: PointerEvent) =>
    props.events.onEdgePointerEnter?.({ edge: edge(), event });
  const onPointerLeave = (event: PointerEvent) =>
    props.events.onEdgePointerLeave?.({ edge: edge(), event });
  const onPointerMove = (event: PointerEvent) =>
    props.events.onEdgePointerMove?.({ edge: edge(), event });
  // The native compiler's delegated `dblclick` never fires and `on:`
  // namespaces are not planned for it — direct attachment is the permanent
  // form here, not a workaround. Attached from the ref callback (see
  // mountElement below): an effect over a ref SIGNAL is dirty for the whole
  // synchronous mount and sits in the pure heap, and every later row's memo
  // pull re-marks that heap (bench round 17/18 — the O(N^2) mount).
  const onDblClick = (event: MouseEvent) =>
    props.events.onEdgeDoubleClick?.({ edge: edge(), event });
  // The runtime does not delegate pointerenter/pointerleave, and dblclick is
  // attached directly: wired only when the flow passes the callback (see
  // NodeWrapper), or they are three listeners per edge for nobody.
  // pointermove likewise, directly and on demand: a delegated pointermove
  // makes every move of every drag walk Solid's dispatcher (bench round 53).
  const mountElement = (el: SVGGElement) => {
    if (props.events.onEdgeDoubleClick) createEventListener(el, "dblclick", onDblClick);
    if (props.events.onEdgePointerEnter) createEventListener(el, "pointerenter", onPointerEnter);
    if (props.events.onEdgePointerLeave) createEventListener(el, "pointerleave", onPointerLeave);
    if (props.events.onEdgePointerMove) createEventListener(el, "pointermove", onPointerMove);
    // Direct spread for user domAttributes, installed on demand — see NodeWrapper.
    spreadOnDemand(el, () => edge()?.domAttributes);
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

  // #15 culling flag: the drawn segment's AABB against the quantized culling
  // viewport. CSS-only — the edge row and its subscriptions stay live.
  const culled = createMemo(() => edgeCulled(edge(), store.cullingActive, onScreenEdgeIds));

  return (
    <EdgeIdContext value={edgeId}>
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
            // Ref callbacks run outside the component owner: keep the wiring
            // owned (and outside the hydration id sequence: see clientOnlySetup).
            runWithOwner(owner, () => clientOnlySetup(() => mountElement(el)));
          }}
          data-id={edge().id}
          tabindex={focusable() ? 0 : undefined}
          role={edge().ariaRole ?? (focusable() ? "group" : "img")}
          aria-label={ariaLabel()}
          aria-roledescription="edge"
          aria-describedby={focusable() ? `${ARIA_EDGE_DESC_KEY}-${store.id}` : undefined}
          class={cx(
            "solid-flow__edge",
            `solid-flow__edge-${edgeType()}`,
            {
              animated: !!edge().animated,
              selected: !!edge().selected,
              selectable: !!selectable(),
            },
            edge().class,
          )}
          onClick={onClick}
          onKeyDown={(e) => focusable() && onKeyDown(e)}
          onContextMenu={onContextMenu}
        >
          <EdgeComponent
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
            pathOptions={edge().pathOptions}
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
    </EdgeIdContext>
  );
};
