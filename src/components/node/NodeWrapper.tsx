import { createEventListener } from "@solid-primitives/event-listener";
import type { JSX } from "@solidjs/web";
import { dynamic, isServer } from "@solidjs/web";
import {
  elementSelectionKeys,
  errorMessages,
  getNodesInside,
  isInputDOMNode,
  nodeHasDimensions,
  type OnDrag,
} from "@xyflow/system";
import {
  type Accessor,
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
  untrack,
} from "solid-js";

import createDraggable from "@/actions/createDraggable";
import { ARIA_NODE_DESC_KEY } from "@/components/accessibility";
import { useInternalSolidFlow } from "@/contexts";
import { NodeConnectableContext } from "@/contexts/nodeConnectable";
import { NodeIdContext } from "@/contexts/nodeId";
import { nodeCulled } from "@/core";
import type { InternalNode, Node, NodeEvents } from "@/types";
import { clientOnlySetup, cx, emitFlowError, spreadOnDemand } from "@/utils";
import { ARROW_KEY_DIFFS, toPxString } from "@/utils";

export type NodeWrapperProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  /** The row, as NodeRenderer's Show narrows it (one resolution per row). */
  readonly node: Accessor<InternalNode<NodeType>>;
  readonly resizeObserver: ResizeObserver | undefined;
  readonly nodeClickDistance: number;
};

/** Internal per-node wrapper: dragging, selection, a11y, measurement, viewport culling, and the dynamic node component. */
export const NodeWrapper = <NodeType extends Node = Node>(
  props: NodeWrapperProps<NodeType>,
): JSX.Element => {
  const { store, parentIds, actions, onScreenNodeIds } = useInternalSolidFlow<NodeType>();
  // Captured for `mountElement` (ref callbacks run outside the component owner).
  const owner = getOwner();

  const [nodeRef, setNodeRef] = createSignal<HTMLDivElement>();

  // ONE row resolution per row: every binding below reads `node()`, Show's
  // narrowed accessor in NodeRenderer (each facade resolution is two
  // store-slot reads; ~55 reads collapse to one). It changes only when the
  // row identity does (same-id reset). Read once: the accessor is stable.
  const node = untrack(() => props.node);

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

  // #15 culling flag: arithmetic re-runs only when this node's geometry,
  // selection, or the quantized culling viewport change; the style only
  // rewrites visibility when the flag actually flips.
  const culled = createMemo(() => nodeCulled(node(), store.cullingActive, onScreenNodeIds));

  // Ownership contract: the user's style (spread first) controls everything
  // cosmetic; the flow owns size, stacking, positioning, culling visibility,
  // and pointer-events — those are assigned LAST so no user style key can
  // defeat measured size or resurrect a culled node. `visibility: visible`
  // is explicit by contract (a user `visibility` never applies). One
  // literal, no intermediate objects: this getter runs inside the element's
  // combined attribute effect, once per node at mount and once per moved
  // node per drag frame (bench round 37).
  const style = (): JSX.CSSProperties => {
    const row = node();
    const isCulled = culled();
    const out: JSX.CSSProperties = row.style ? { ...row.style } : {};
    const w = row.width ?? row.initialWidth;
    const h = row.height ?? row.initialHeight;
    if (w) out.width = toPxString(w);
    if (h) out.height = toPxString(h);
    out["z-index"] = row.internals.z;
    // The transform is written straight onto the element by its own render
    // effect (mountElement): a moved node then writes one property instead
    // of rebuilding and diffing this whole object per frame (bench round
    // 42: ~55 ms of a 10k move-all). Server markup still carries it so a
    // node is positioned before hydration.
    // A user `transform` never applies (the binding would otherwise write it
    // over the render effect's).
    if (out.transform !== undefined) delete out.transform;
    if (isServer) {
      const { x, y } = row.internals.positionAbsolute;
      out.transform = `translate(${x}px, ${y}px)`;
    }
    out.visibility = isCulled || !nodeHasDimensions(row) ? "hidden" : "visible";
    out["pointer-events"] = isCulled ? "none" : undefined;
    return out;
  };

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
    // The one per-frame DOM write of a moved node (see `style`): a render
    // effect over the row's absolute position, no style-object diff.
    createRenderEffect(
      () => {
        const { x, y } = node().internals.positionAbsolute;
        return `translate(${x}px, ${y}px)`;
      },
      (transform) => {
        el.style.transform = transform;
      },
    );
    // `pointerenter`/`pointerleave` cannot be delegated (they do not bubble)
    // and the compiler attaches a listener even for an undefined handler:
    // attached here only when the flow passes the callback, so the common
    // case pays no listener per node (head-to-head round 1: 8 per node vs
    // 5/4). `pointermove` is attached here too, directly and on demand: a
    // delegated pointermove makes every move of every drag walk Solid's
    // dispatcher from the pointer to the root (~45 us of a ~470 us move at
    // 10k, bench rounds 49 and 53). contextmenu, keydown, click and focusin
    // are delegated by the runtime.
    if (props.onNodePointerMove) {
      createEventListener(el, "pointermove", (event) =>
        props.onNodePointerMove?.({ node: userNode(), event }),
      );
    }
    if (props.onNodePointerEnter) {
      createEventListener(el, "pointerenter", (event) =>
        props.onNodePointerEnter?.({ node: userNode(), event }),
      );
    }
    if (props.onNodePointerLeave) {
      createEventListener(el, "pointerleave", (event) =>
        props.onNodePointerLeave?.({ node: userNode(), event }),
      );
    }
    // The native compiler's delegated `dblclick` never fires and `on:`
    // namespaces are not planned for it — direct attachment is the permanent
    // form here, not a workaround; like the pointer pair, only with a callback.
    if (props.onNodeDoubleClick) {
      createEventListener(el, "dblclick", (event) =>
        props.onNodeDoubleClick?.({ node: userNode(), event }),
      );
    }

    // One effect per node for the element-dependent lifecycle (two cost a
    // measurable 10k effect nodes, bench round 37): the (re)measure request
    // when the node's type or handle positions change — the unknown-type
    // report (error003, upstream parity) rides on the type too — and the
    // resize observation, (re)done when the observer changes or the node's
    // dimensions are lost so it gets measured again.
    createEffect(
      () => ({
        id: node().id,
        nodeType: nodeType(),
        nodeTypeValid: nodeTypeValid(),
        sourcePosition: node().sourcePosition,
        targetPosition: node().targetPosition,
        hasDimensions: nodeHasDimensions(node()),
        resizeObserver: props.resizeObserver,
      }),
      (current, prev) => {
        if (!current.nodeTypeValid && (!prev || prev.nodeType !== current.nodeType)) {
          emitFlowError(store.onError, "003", errorMessages["error003"](current.nodeType));
        }
        if (
          !prev ||
          prev.resizeObserver !== current.resizeObserver ||
          (prev.hasDimensions && !current.hasDimensions)
        ) {
          prev?.resizeObserver?.unobserve(el);
          current.resizeObserver?.observe(el);
        }
        if (
          !prev ||
          prev.sourcePosition !== current.sourcePosition ||
          prev.targetPosition !== current.targetPosition ||
          prev.nodeType !== current.nodeType
        ) {
          actions.requestUpdateNodeInternals([
            [current.id, { id: current.id, nodeElement: el, force: true }],
          ]);
        }
      },
      { name: "node.element" },
    );

    // User `domAttributes` via a direct spread, NOT a JSX spread: the compiler
    // folds a JSX spread into `merge({...bindings}, () => attrs)` — a
    // memo-backed source every attribute binding reads. Installed on demand:
    // rows without domAttributes skip the spread machinery entirely.
    spreadOnDemand(el, () => node()?.domAttributes);

    const onDrag: OnDrag = (event, _, targetNode, nodes) => {
      props.onNodeDrag?.({
        event,
        targetNode: targetNode as NodeType,
        nodes: nodes as NodeType[],
      });
    };

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
        onDrag: props.onNodeDrag ? onDrag : undefined,
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

  // `hidden` is decided by NodeRenderer's membership Show (one Show per row,
  // not two): this wrapper only ever runs for a present, non-hidden row.
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        // Ref callbacks run outside the component owner: keep the wiring
        // owned (disposal, no NO_OWNER diagnostics).
        // (and outside the hydration id sequence: see clientOnlySetup)
        runWithOwner(owner, () => clientOnlySetup(() => mountElement(el)));
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
      onContextMenu={(event) => props.onNodeContextMenu?.({ node: userNode(), event })}
      onKeyDown={(e) => focusable() && onKeyDown(e)}
      // Delegated focusin (React's onFocus bubbles the same way); onFocus guards
      // on THIS element matching :focus-visible, so a descendant's focus returns.
      onFocusIn={() => focusable() && onFocus()}
      tabindex={focusable() ? 0 : undefined}
      role={node().ariaRole ?? (focusable() ? "group" : undefined)}
      aria-roledescription="node"
      aria-describedby={store.disableKeyboardA11y ? undefined : `${ARIA_NODE_DESC_KEY}-${store.id}`}
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
  );
};
