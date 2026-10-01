import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { type Align, getNodeToolbarTransform, Position as SystemPosition } from "@xyflow/system";
import { getOwner, type ParentComponent, Show, useContext } from "solid-js";

import { cx, extraKeysOf, spreadExtras } from "@/components/internal/dom";
import { useInternalSolidFlow } from "@/contexts";
import { NodeIdContext } from "@/contexts/nodeId";
import type { InternalNode, Position } from "@/types";

/** Props for the `NodeToolbar` plugin. */
export type NodeToolbarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  /** The id of the node, or array of ids the toolbar should be displayed at */
  readonly nodeId: string | string[];
  /** Position of the toolbar relative to the node
   * @example "top" | "right" | "bottom" | "left"
   */
  readonly position: Position;
  /** Align the toolbar relative to the node
   * @example Align.Start, Align.Center, Align.End
   */
  readonly align: Align;
  /** Offset the toolbar from the node */
  readonly offset: number;
  /** If true, node toolbar is visible even if node is not selected */
  readonly isVisible: boolean;
  /** Style of the toolbar */
  readonly style: Omit<JSX.CSSProperties, "z-index" | "position" | "transform">;
};

/**
 * The props NodeToolbar consumes itself plus the attributes it sets on its
 * element (an extra prop never overrides them); every other key is an
 * attribute of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "nodeId",
  "position",
  "align",
  "offset",
  "isVisible",
  "style",
  "children",
  "class",
  "data-id",
]);

/** Toolbar attached to a node, rendered above the graph so it does not scale with zoom. */
export const NodeToolbar: ParentComponent<Partial<NodeToolbarProps>> = (props) => {
  // Internal components read the internal context only (audit D3/D5):
  // flow for the public read surface, commands for the write surface.
  const { store, flow, commands } = useInternalSolidFlow();

  // One per node that carries it, hidden until shown: the per-row rules (see
  // Handle) instead of a propDefaults getter object and an omit record.
  const offset = () => props.offset ?? 10;
  const position = () => props.position ?? "top";
  const align = () => props.align ?? "center";
  const extraKeys = extraKeysOf(props, OWN_KEYS);
  const owner = getOwner();

  // NodeToolbar can be rendered outside of a node (with `nodeId`), so the
  // context is optional; looked up once, here in the body.
  const contextNodeId = useContext(NodeIdContext);
  const ctxNodeId = () => (contextNodeId ? contextNodeId() : "");

  const toolbarNodes = () => {
    const nodeIds = Array.isArray(props.nodeId) ? props.nodeId : [props.nodeId ?? ctxNodeId()];

    return nodeIds.reduce<InternalNode[]>((res, nodeId) => {
      const node = flow.internalNodes[nodeId];
      if (node) res.push(node);
      return res;
    }, []);
  };

  const transform = () => {
    const nodeRect = commands.getNodesBounds(toolbarNodes());

    return !nodeRect
      ? ""
      : getNodeToolbarTransform(
          nodeRect,
          store.viewport,
          position() as SystemPosition,
          offset(),
          align(),
        );
  };

  const zIndex = () => {
    const nodes = toolbarNodes();
    return nodes.length === 0 ? 1 : Math.max(...nodes.map((node) => (node.internals.z || 5) + 1));
  };

  const selectedNodesCount = () => flow.selection.nodes.length;

  const isActive = () => {
    const nodes = toolbarNodes();
    return typeof props.isVisible === "boolean"
      ? props.isVisible
      : nodes.length === 1 && Boolean(nodes[0]!.selected) && selectedNodesCount() === 1;
  };

  const showPortal = () => Boolean(store.domNode && isActive() && toolbarNodes().length > 0);

  return (
    <Show when={showPortal()}>
      <Portal mount={store.domNode!}>
        <div
          ref={(el) => spreadExtras(el, props, extraKeys, owner)}
          // The user's class joins the toolbar's (React Flow's cc([...])); a
          // spread `class` replaced it.
          class={cx("solid-flow__node-toolbar", props.class)}
          data-id={toolbarNodes()
            .reduce((acc, node) => `${acc}${node.id} `, "")
            .trim()}
          style={{
            position: "absolute",
            transform: transform(),
            "z-index": zIndex(),
            ...props.style,
          }}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
};
