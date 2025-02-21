import { getInternalNodesBounds, isNumeric } from "@xyflow/system";
import clsx from "clsx";
import { type Component, Show } from "solid-js";

// @ts-expect-error 6133 - Typescript is not able to discern that directive functions are used in JSX
import drag from "@/actions/drag";
import { useFlowStore } from "@/components/contexts";
import Selection from "@/components/graph/selection/Selection";
import type { GraphMultiTargetHandler } from "@/shared/types/events";
import type { Node, NodeEventCallbacks } from "@/shared/types/node";

type NodeSelectionProps = Partial<NodeEventCallbacks> & {
  readonly onSelectionContextMenu?: GraphMultiTargetHandler<Node>;
  readonly onSelectionClick?: GraphMultiTargetHandler<Node>;
};

const NodeSelection: Component<NodeSelectionProps> = (props) => {
  const flowStore = useFlowStore();
  const { store } = flowStore;

  const bounds = () => {
    if (store.selectionRectMode === "nodes") {
      return getInternalNodesBounds(store.nodeLookup, {
        filter: (node) => !!node.selected,
      });
    }
    return null;
  };

  const onContextMenu = (event: MouseEvent | TouchEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionContextMenu?.(selectedNodes, event);
  };

  const onClick = (event: MouseEvent | TouchEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionClick?.(selectedNodes, event);
  };

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
        use:drag={{
          disabled: false,
          onDrag: (event: MouseEvent | TouchEvent, _, __, nodes: Node[]) => {
            props.onNodeDrag?.(null, nodes, event);
          },
          onDragStart: (event: MouseEvent | TouchEvent, _, __, nodes: Node[]) => {
            props.onNodeDragStart?.(null, nodes, event);
          },
          onDragStop: (event: MouseEvent | TouchEvent, _, __, nodes: Node[]) => {
            props.onNodeDragStop?.(null, nodes, event);
          },
        }}
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
