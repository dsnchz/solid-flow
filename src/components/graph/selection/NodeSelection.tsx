import { getInternalNodesBounds, isNumeric } from "@xyflow/system";
import clsx from "clsx";
import { createSignal, Show } from "solid-js";

import createDraggable from "@/actions/createDraggable";
import { useFlowStore } from "@/components/contexts";
import Selection from "@/components/graph/selection/Selection";
import type { GraphMultiTargetHandler, MouseOrTouchEvent } from "@/shared/types/events";
import type { Node, NodeEventCallbacks } from "@/shared/types/node";

type NodeSelectionProps<NodeType extends Node = Node> = Partial<NodeEventCallbacks<NodeType>> & {
  readonly onSelectionContextMenu?: GraphMultiTargetHandler<NodeType>;
  readonly onSelectionClick?: GraphMultiTargetHandler<NodeType>;
};

const NodeSelection = <NodeType extends Node = Node>(props: NodeSelectionProps<NodeType>) => {
  const { store } = useFlowStore<NodeType>();
  const [ref, setRef] = createSignal<HTMLDivElement>();

  const bounds = () => {
    if (store.selectionRectMode === "nodes") {
      return getInternalNodesBounds(store.nodeLookup, {
        filter: (node) => !!node.selected,
      });
    }
    return null;
  };

  const onContextMenu = (event: MouseOrTouchEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionContextMenu?.(selectedNodes, event);
  };

  const onClick = (event: MouseOrTouchEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionClick?.(selectedNodes, event);
  };

  createDraggable(ref, () => ({
    disabled: false,
    onDrag: (event, _, __, nodes) => {
      props.onNodeDrag?.(null, nodes, event);
    },
    onDragStart: (event, _, __, nodes) => {
      props.onNodeDragStart?.(null, nodes, event);
    },
    onDragStop: (event, _, __, nodes) => {
      props.onNodeDragStop?.(null, nodes, event);
    },
  }));

  return (
    <Show
      when={
        store.selectionRectMode === "nodes" &&
        bounds() &&
        isNumeric(bounds()?.x) &&
        isNumeric(bounds()?.y)
      }
    >
      <div
        class={clsx("selection-wrapper", "nopan")}
        style={{
          width: `${bounds()!.width}px`,
          height: `${bounds()!.height}px`,
          transform: `translate(${bounds()!.x}px, ${bounds()!.y}px)`,
        }}
        ref={setRef}
        onContextMenu={onContextMenu}
        onClick={onClick}
        role="button"
        tabindex="-1"
        onKeyUp={() => {}}
      >
        <Selection width="100%" height="100%" x={0} y={0} />
      </div>
    </Show>
  );
};

export default NodeSelection;
