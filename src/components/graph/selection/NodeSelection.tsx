import { getInternalNodesBounds, isNumeric } from "@xyflow/system";
import clsx from "clsx";
import { createEffect, createSignal, Show } from "solid-js";

import createDraggable from "~/actions/createDraggable";
import { useInternalSolidFlow } from "~/components/contexts";
import type { Node, NodeEvents, NodeSelectionEvents } from "~/types";
import { ARROW_KEY_DIFFS, toPxString } from "~/utils";

import { Selection } from "./Selection";

export type NodeSelectionProps<NodeType extends Node = Node> = NodeSelectionEvents<NodeType> &
  Pick<NodeEvents<NodeType>, "onNodeDrag" | "onNodeDragStart" | "onNodeDragStop">;

export const NodeSelection = <NodeType extends Node = Node>(
  props: NodeSelectionProps<NodeType>,
) => {
  const { store, nodeLookup, actions } = useInternalSolidFlow<NodeType>();
  const [ref, setRef] = createSignal<HTMLDivElement>();

  const bounds = () => {
    if (store.selectionRectMode === "nodes") {
      return getInternalNodesBounds(nodeLookup, {
        filter: (node) => !!node.selected,
      });
    }
    return null;
  };

  createEffect(() => {
    if (!store.disableKeyboardA11y) {
      ref()?.focus({ preventScroll: true });
    }
  });

  const onContextMenu = (event: PointerEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionContextMenu?.({ nodes: selectedNodes, event });
  };

  const onClick = (event: MouseEvent) => {
    const selectedNodes = store.nodes.filter((n) => n.selected);
    props.onSelectionClick?.({ nodes: selectedNodes, event });
  };

  createDraggable(ref, () => ({
    disabled: false,
    onDrag: (event, _, __, nodes) => {
      props.onNodeDrag?.({ event, targetNode: null, nodes: nodes as NodeType[] });
    },
    onDragStart: (event, _, __, nodes) => {
      props.onNodeDragStart?.({ event, targetNode: null, nodes: nodes as NodeType[] });
    },
    onDragStop: (event, _, __, nodes) => {
      props.onNodeDragStop?.({ event, targetNode: null, nodes: nodes as NodeType[] });
    },
  }));

  const onKeyDown = (event: KeyboardEvent) => {
    const diff = ARROW_KEY_DIFFS[event.key];

    if (!diff) return;

    event.preventDefault();
    actions.moveSelectedNodes(diff, event.shiftKey ? 4 : 1);
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
        ref={setRef}
        class={clsx("solid-flow__selection-wrapper", store.noPanClass)}
        style={{
          width: toPxString(bounds()?.width),
          height: toPxString(bounds()?.height),
          transform: `translate(${bounds()?.x}px, ${bounds()?.y}px)`,
        }}
        onClick={onClick}
        onContextMenu={onContextMenu}
        role={store.disableKeyboardA11y ? undefined : "button"}
        tabIndex={store.disableKeyboardA11y ? undefined : -1}
        onKeyDown={store.disableKeyboardA11y ? undefined : onKeyDown}
      >
        <Selection width="100%" height="100%" x={0} y={0} />
      </div>
    </Show>
  );
};
