import { type Align, getNodeToolbarTransform, Position as SystemPosition } from "@xyflow/system";
import { type JSX, mergeProps, type ParentComponent, Show, splitProps, useContext } from "solid-js";
import { Portal } from "solid-js/web";

import { NodeIdContext } from "@/components/contexts/nodeId";
import { useSolidFlow } from "@/hooks";
import { useSolidFlowStore } from "@/hooks/useSolidFlowStore";
import type { InternalNode, Position } from "@/types";

export type NodeToolbarProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  /** The id of the node, or array of ids the toolbar should be displayed at */
  readonly nodeId: string | string[];
  /** Position of the toolbar relative to the node
   * @example Position.TopLeft, Position.TopRight,
   * Position.BottomLeft, Position.BottomRight
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

export const NodeToolbar: ParentComponent<Partial<NodeToolbarProps>> = (props) => {
  const store = useSolidFlowStore();
  const { getNodes, getNodesBounds, getInternalNode } = useSolidFlow();

  const ctxNodeId = () => {
    // NodeToolbar can be rendered outside of NodeWrapper, so we need to use the context directly.
    const id = useContext(NodeIdContext);
    return id ? id() : "";
  };

  const _props = mergeProps(
    {
      offset: 10,
      position: "top" as Position,
      align: "center" as Align,
      style: {} as Omit<JSX.CSSProperties, "z-index" | "position" | "transform">,
    },
    props,
  );

  const [local, divProps] = splitProps(_props, [
    "nodeId",
    "position",
    "align",
    "offset",
    "isVisible",
    "style",
    "children",
  ]);

  const toolbarNodes = () => {
    const nodeIds = Array.isArray(local.nodeId) ? local.nodeId : [local.nodeId ?? ctxNodeId()];

    return nodeIds.reduce<InternalNode[]>((res, nodeId) => {
      const node = getInternalNode(nodeId);
      if (node) res.push(node);
      return res;
    }, []);
  };

  const transform = () => {
    const nodeRect = getNodesBounds(toolbarNodes());

    return !nodeRect
      ? ""
      : getNodeToolbarTransform(
          nodeRect,
          store.viewport,
          local.position as SystemPosition,
          local.offset,
          local.align,
        );
  };

  const zIndex = () => {
    const nodes = toolbarNodes();
    return nodes.length === 0 ? 1 : Math.max(...nodes.map((node) => (node.internals.z || 5) + 1));
  };

  const selectedNodesCount = () => getNodes().filter((node) => node.selected).length;

  const isActive = () => {
    const nodes = toolbarNodes();
    return typeof local.isVisible === "boolean"
      ? local.isVisible
      : nodes.length === 1 && Boolean(nodes[0]!.selected) && selectedNodesCount() === 1;
  };

  const showPortal = () => Boolean(store.domNode && isActive() && toolbarNodes().length > 0);

  return (
    <Show when={showPortal()}>
      <Portal mount={store.domNode!}>
        <div
          class="solid-flow__node-toolbar"
          data-id={toolbarNodes()
            .reduce((acc, node) => `${acc}${node.id} `, "")
            .trim()}
          style={{
            // TODO: Add hideOnSSR display style from Svelte implementation
            position: "absolute",
            transform: transform(),
            "z-index": zIndex(),
            ...local.style,
          }}
          {...divProps}
        >
          {local.children}
        </div>
      </Portal>
    </Show>
  );
};
