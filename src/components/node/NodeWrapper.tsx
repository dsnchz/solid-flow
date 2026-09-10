import { createEventListener } from "@solid-primitives/event-listener";
import type { JSX } from "@solidjs/web";
import { dynamic, spread } from "@solidjs/web";
import {
  elementSelectionKeys,
  errorMessages,
  getNodesInside,
  isInputDOMNode,
  nodeHasDimensions,
} from "@xyflow/system";
import {
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  Show,
} from "solid-js";

import createDraggable from "@/actions/createDraggable";
import { ARIA_NODE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/contexts";
import { NodeConnectableContext } from "@/contexts/nodeConnectable";
import { NodeIdContext } from "@/contexts/nodeId";
import { nodeCulled } from "@/core";
import type { Node, NodeEvents } from "@/types";
import { cx, emitFlowError } from "@/utils";
import { ARROW_KEY_DIFFS, toPxString } from "@/utils";

export type NodeWrapperProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  readonly nodeId: string;
  readonly resizeObserver: ResizeObserver | undefined;
  readonly nodeClickDistance: number;
};

/** Internal per-node wrapper: dragging, selection, a11y, measurement, viewport culling, and the dynamic node component. */
export const NodeWrapper = <NodeType extends Node = Node>(
  props: NodeWrapperProps<NodeType>,
): JSX.Element => {
  const { store, nodeLookup, parentIds, actions, onScreenNodeIds } =
    useInternalSolidFlow<NodeType>();
  // Captured for `mountElement` (ref callbacks run outside the component owner).
  const owner = getOwner();

  const [nodeRef, setNodeRef] = createSignal<HTMLDivElement>();

  // ONE row resolution per wrapper: every binding below reads `node()`, and
  // each resolution through the facade is two store-slot reads (holder slot,
  // then the row store's `row` slot). The memo re-runs only when the row
  // identity changes (same-id reset), so ~55 reads collapse to one.
  const node = createMemo(() => nodeLookup.get(props.nodeId)!);

  // The shared observer outlives this wrapper — without unobserve on dispose
  // it pins the detached element in the observer's target list.
  onCleanup(() => {
    const el = nodeRef();
    if (el) props.resizeObserver?.unobserve(el);
  });

  const nodeId = () => node().id;
  const nodeType = () => node().type ?? "default";
  const deletable = () => node().deletable ?? true;
  const selectable = () => node().selectable ?? store.elementsSelectable;
  const focusable = () => node().focusable ?? store.nodesFocusable;
  const draggable = () => node().draggable ?? store.nodesDraggable;
  const connectable = () => node().connectable ?? store.nodesConnectable;
  const userNode = () => node().internals.userNode;

  const nodeTypeValid = () => nodeType() in store.nodeTypes;
  // Upstream parity (error003): unknown types render the default component
  // instead of nothing.
  const nodeComponent = () => store.nodeTypes[nodeTypeValid() ? nodeType() : "default"];
  // `dynamic()` directly: <Dynamic> re-copies every prop descriptor per row
  // (its `omit(props, "component")`), ~110ms of a 10k mount (bench round 21).
  const NodeComponent = dynamic(nodeComponent);
  const isParentNode = () => !!parentIds[node().id];

  const transform = () => {
    const { x, y } = node().internals.positionAbsolute;
    return `translate(${x}px, ${y}px)`;
  };

  const sizeStyle = () => {
    const w = node().width ?? node().initialWidth;
    const h = node().height ?? node().initialHeight;

    return {
      ...node().style,
      ...(w ? { width: toPxString(w) } : {}),
      ...(h ? { height: toPxString(h) } : {}),
    };
  };

  // #15 culling flag: arithmetic re-runs only when this node's geometry,
  // selection, or the quantized culling viewport change; the style only
  // rewrites visibility when the flag actually flips.
  const culled = createMemo(() => nodeCulled(node(), store.cullingActive, onScreenNodeIds));

  // Ownership contract: the user's style (spread first, inside sizeStyle)
  // controls everything cosmetic; the flow owns size, stacking, positioning,
  // culling visibility, and pointer-events — those come LAST so no user
  // style key can defeat measured size or resurrect a culled node.
  const style = () =>
    ({
      ...sizeStyle(),
      "z-index": node().internals.z,
      transform: transform(),
      visibility: culled() || !nodeHasDimensions(node()) ? "hidden" : "visible",
      "pointer-events": culled() ? "none" : undefined,
    }) as const;

  createEffect(
    () => ({ valid: nodeTypeValid(), nodeType: nodeType() }),
    ({ valid, nodeType }) => {
      if (!valid) {
        emitFlowError(store.onError, "003", errorMessages["error003"](nodeType));
      }
    },
  );

  const onSelectNodeHandler = (event: MouseEvent) => {
    if (selectable() && (!store.selectNodesOnDrag || !draggable() || store.nodeDragThreshold > 0)) {
      // this handler gets called by XYDrag on drag start when selectNodesOnDrag=true
      // here we only need to call it when selectNodesOnDrag=false
      actions.handleNodeSelection(node().id);
    }

    props.onNodeClick?.({ node: userNode(), event });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isInputDOMNode(event) || store.disableKeyboardA11y) {
      return;
    }

    if (elementSelectionKeys.includes(event.key) && selectable()) {
      actions.handleNodeSelection(node().id, event.key === "Escape", nodeRef());
      return;
    }

    const arrowKeyDiff = ARROW_KEY_DIFFS[event.key];

    if (draggable() && node().selected && arrowKeyDiff) {
      {
        // prevent default scrolling behavior on arrow key press when node is moved
        event.preventDefault();
        actions.setAriaLiveMessage(
          store.ariaLabelConfig["node.a11yDescription.ariaLiveMessage"]({
            direction: event.key.replace("Arrow", "").toLowerCase(),
            x: ~~node().internals.positionAbsolute.x,
            y: ~~node().internals.positionAbsolute.y,
          }),
        );

        actions.moveSelectedNodes(arrowKeyDiff, event.shiftKey ? 4 : 1);
      }
    }
  };

  const onFocus = () => {
    if (
      store.disableKeyboardA11y ||
      !store.autoPanOnNodeFocus ||
      !nodeRef()?.matches(":focus-visible")
    ) {
      return;
    }

    const { width, height, viewport } = store;

    const withinViewport =
      getNodesInside(
        new Map([[node().id, node()]]),
        { x: 0, y: 0, width, height },
        [viewport.x, viewport.y, viewport.zoom],
        true,
      ).length > 0;

    if (withinViewport) return;

    void actions.setCenter(
      node().position.x + (node().measured.width ?? 0) / 2,
      node().position.y + (node().measured.height ?? 0) / 2,
      { zoom: viewport.zoom },
    );
  };

  // Element-dependent wiring lives in `mountElement` (below): effects created
  // there depend on the node's fields and props, never on the ref signal.
  // An effect over a signal written during the row's own mount (`nodeRef`)
  // is dirty for the whole synchronous mount and sits in the pure heap; every
  // later row's memo pull re-marks that heap (`markHeap`), which made a 10k
  // mount O(N^2) — .agent/spikes/p34-markheap-mount, bench round 17.
  const mountElement = (el: HTMLDivElement) => {
    // The native compiler's delegated `dblclick` never fires and `on:`
    // namespaces are not planned for it — direct attachment is the permanent
    // form here, not a workaround.
    createEventListener(el, "dblclick", (event) =>
      props.onNodeDoubleClick?.({ node: userNode(), event }),
    );

    // Request a (re)measure when the node's type or handle positions change.
    createEffect(
      () => ({
        id: node().id,
        nodeType: nodeType(),
        sourcePosition: node().sourcePosition,
        targetPosition: node().targetPosition,
      }),
      (current, prev) => {
        if (
          prev &&
          prev.sourcePosition === current.sourcePosition &&
          prev.targetPosition === current.targetPosition &&
          prev.nodeType === current.nodeType
        ) {
          return;
        }
        actions.requestUpdateNodeInternals([
          [current.id, { id: current.id, nodeElement: el, force: true }],
        ]);
      },
      { name: "node.measure" },
    );

    // (Re)observe when the observer changes, and re-observe when the node's
    // dimensions are lost so it gets measured again.
    createEffect(
      () => ({
        hasDimensions: nodeHasDimensions(node()),
        resizeObserver: props.resizeObserver,
      }),
      (current, prev) => {
        if (prev && current.resizeObserver === prev.resizeObserver && current.hasDimensions) {
          return;
        }
        prev?.resizeObserver?.unobserve(el);
        current.resizeObserver?.observe(el);
      },
      { name: "node.resizeObserver" },
    );

    // User `domAttributes` via a direct spread, NOT a JSX spread: the compiler
    // folds a JSX spread into `merge({...bindings}, () => attrs)` — a
    // memo-backed source every attribute binding reads.
    spread(el, () => node()?.domAttributes ?? {}, true);

    createDraggable(
      () => el,
      () => ({
        nodeId: node().id,
        isSelectable: selectable(),
        disabled: !draggable(),
        handleSelector: node().dragHandle,
        noDragClass: store.noDragClass,
        nodeClickDistance: props.nodeClickDistance,
        onNodeMouseDown: actions.handleNodeSelection,
        // Only when a user handler exists: with `onDrag` set, XYDrag builds
        // the handler params EVERY frame — a spread of every dragged node's
        // store proxy (audit finding 6; a 1000-node selection drag paid it
        // with no listener registered). Start/stop stay unconditional (the
        // drag helper needs them; once per gesture).
        onDrag: props.onNodeDrag
          ? (event, _, targetNode, nodes) => {
              props.onNodeDrag?.({
                event,
                targetNode: targetNode as NodeType,
                nodes: nodes as NodeType[],
              });
            }
          : undefined,
        onDragStart: (event, _, targetNode, nodes) => {
          props.onNodeDragStart?.({
            event,
            targetNode: targetNode as NodeType,
            nodes: nodes as NodeType[],
          });
        },
        onDragStop: (event, _, targetNode, nodes) => {
          props.onNodeDragStop?.({
            event,
            targetNode: targetNode as NodeType,
            nodes: nodes as NodeType[],
          });
        },
      }),
    );
  };

  return (
    <Show when={!node().hidden}>
      <div
        ref={(el) => {
          setNodeRef(el);
          // Ref callbacks run outside the component owner: keep the wiring
          // owned (disposal, no NO_OWNER diagnostics).
          runWithOwner(owner, () => mountElement(el));
        }}
        data-id={node().id}
        class={cx(
          "solid-flow__node",
          `solid-flow__node-${nodeType()}`,
          {
            connectable: !!connectable(),
            draggable: !!draggable(),
            dragging: !!node().dragging,
            nopan: !!draggable(),
            parent: isParentNode(),
            selectable: !!selectable(),
            selected: !!node().selected,
          },
          node().class,
        )}
        style={style()}
        onClick={onSelectNodeHandler}
        onPointerEnter={(event) => props.onNodePointerEnter?.({ node: userNode(), event })}
        onPointerLeave={(event) => props.onNodePointerLeave?.({ node: userNode(), event })}
        onPointerMove={(event) => props.onNodePointerMove?.({ node: userNode(), event })}
        onContextMenu={(event) => props.onNodeContextMenu?.({ node: userNode(), event })}
        onKeyDown={(e) => focusable() && onKeyDown(e)}
        onFocus={() => focusable() && onFocus()}
        tabindex={focusable() ? 0 : undefined}
        role={node().ariaRole ?? (focusable() ? "group" : undefined)}
        aria-roledescription="node"
        aria-describedby={
          store.disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${store.id}`
        }
      >
        <NodeIdContext value={nodeId}>
          <NodeConnectableContext value={connectable}>
            <NodeComponent
              data={node().data}
              id={node().id}
              selected={Boolean(node().selected)}
              selectable={selectable()}
              deletable={deletable()}
              sourcePosition={node().sourcePosition}
              targetPosition={node().targetPosition}
              zIndex={node().internals.z}
              dragging={!!node().dragging}
              draggable={draggable()}
              dragHandle={node().dragHandle}
              parentId={node().parentId}
              type={nodeType()}
              isConnectable={connectable()}
              positionAbsoluteX={node().internals.positionAbsolute.x}
              positionAbsoluteY={node().internals.positionAbsolute.y}
              width={node().width}
              height={node().height}
            />
          </NodeConnectableContext>
        </NodeIdContext>
      </div>
    </Show>
  );
};
