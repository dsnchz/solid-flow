import { type Align, getNodeToolbarTransform, Position } from "@xyflow/system";
import { type ParentComponent, Show } from "solid-js";
import { Portal } from "solid-js/web";

import { useFlowStore, useNodeId } from "@/components/contexts";
import type { InternalNode } from "@/shared/types";

export type NodeToolbarProps = {
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
};

const NodeToolbar: ParentComponent<Partial<NodeToolbarProps>> = (props) => {
  const { store, getNodesBounds } = useFlowStore();
  const contextNodeId = useNodeId();

  const getToolbarNodes = () => {
    const nodeIds = Array.isArray(props.nodeId) ? props.nodeId : [props.nodeId || contextNodeId()];
    return nodeIds.reduce<InternalNode[]>((res, nodeId) => {
      const node = store.nodeLookup?.get(nodeId);
      if (node) {
        res.push(node);
      }
      return res;
    }, []);
  };

  const getTransform = () => {
    const toolbarNodes = getToolbarNodes();
    const nodeRect = getNodesBounds(toolbarNodes);
    const _offset = props.offset !== undefined ? props.offset : 10;
    const _position = props.position !== undefined ? props.position : Position.Top;
    const _align = props.align !== undefined ? props.align : "center";

    if (nodeRect) {
      return getNodeToolbarTransform(nodeRect, store.viewport, _position, _offset, _align);
    }
    return "";
  };

  const getZIndex = () => {
    const toolbarNodes = getToolbarNodes();
    return toolbarNodes.length === 0
      ? 1
      : Math.max(...toolbarNodes.map((node) => (node.internals.z || 5) + 1));
  };

  const getSelectedNodesCount = () => store.nodes.filter((node) => node.selected).length;

  const isActive = () => {
    const toolbarNodes = getToolbarNodes();
    return typeof props.isVisible === "boolean"
      ? props.isVisible
      : toolbarNodes.length === 1 &&
          Boolean(toolbarNodes[0]!.selected) &&
          getSelectedNodesCount() === 1;
  };

  const showPortal = () => Boolean(store.domNode && isActive() && getToolbarNodes().length > 0);

  return (
    <Show when={showPortal()}>
      <Portal mount={store.domNode!}>
        <div
          data-id={getToolbarNodes()
            .reduce((acc, node) => `${acc}${node.id} `, "")
            .trim()}
          class="solid-flow__node-toolbar"
          style={{
            position: "absolute",
            transform: getTransform(),
            "z-index": getZIndex(),
          }}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
};

export default NodeToolbar;
