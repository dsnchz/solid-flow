import type { JSX } from "@solidjs/web";
import { isServer } from "@solidjs/web";
import { For, onCleanup, Show } from "solid-js";

import { NodeWrapper } from "@/components/node/NodeWrapper";
import { useInternalSolidFlow } from "@/contexts";
import { createMountedIds } from "@/core";
import type { Node, NodeEvents } from "@/types";

import { createFocusedIdTracker } from "./focusedIdTracker";

export type NodeRendererProps<NodeType extends Node = Node> = NodeEvents<NodeType> & {
  /**
   * Row elements mount only once this is true (SolidFlow flips it in
   * onSettled): the engine builds the row tree ~20-30% cheaper in the settle
   * flush than inside the initial render(), and the culling viewport and
   * pan-zoom exist before the first row does (mount profile round 30).
   */
  rowsReady?: () => boolean;
  readonly nodeClickDistance: number;
};

const NO_ROWS: readonly string[] = [];

/** Internal renderer iterating the node id list into `NodeWrapper`s; owns the shared measurement `ResizeObserver`. */
export const NodeRenderer = <NodeType extends Node = Node>(
  props: NodeRendererProps<NodeType>,
): JSX.Element => {
  const { actions, store, nodeLookup, onScreenNodeIds, nodeCullPins } =
    useInternalSolidFlow<NodeType>();

  // Nodes are measured in the browser only; during SSR the observer is absent
  // and NodeWrapper's measurement effect never runs.
  const resizeObserver = isServer
    ? undefined
    : new ResizeObserver((entries: ResizeObserverEntry[]) => {
        actions.requestUpdateNodeInternals(
          entries.map((entry: ResizeObserverEntry) => {
            const id = entry.target.getAttribute("data-id") as string;
            return [
              id,
              {
                id,
                nodeElement: entry.target as HTMLDivElement,
                force: true,
              },
            ];
          }),
        );
      });

  onCleanup(() => {
    resizeObserver?.disconnect();
  });

  // The unmount tier's focus guard: focusin bubbles from any descendant (a
  // custom node's input included), so the node holding DOM focus is known
  // here and never unmounted mid-interaction — focus cannot survive removal.
  const { focusedId: focusedNodeId, onFocusIn, onFocusOut } = createFocusedIdTracker();

  // Opt-in unmount culling (onlyRenderVisibleElements): the `For` iterates
  // only the rows to mount, so an off-screen row has no scope at all (#22);
  // the list wakes on membership flips only (see createMountedIds).
  const mountedIds = createMountedIds(
    {
      get ids() {
        return (props.rowsReady?.() ?? true) ? store.visibleNodeIds : NO_ROWS;
      },
      get active() {
        return store.onlyRenderVisibleElements && store.cullingActive;
      },
      onScreen: onScreenNodeIds,
      pins: nodeCullPins,
      get focusedId() {
        return focusedNodeId();
      },
    },
    "nodeRenderer.mountedIds",
  );

  return (
    <div
      class="solid-flow__container solid-flow__nodes"
      onFocusIn={onFocusIn}
      onFocusOut={onFocusOut}
    >
      <For each={mountedIds()}>
        {(nodeId) => {
          // Membership now comes from the user-facing store; the projection
          // row materializes in the same flush, but guard the window (and
          // any future null-row semantics) rather than crash NodeWrapper.
          // `hidden` is decided here too — one Show per row instead of a
          // second one inside the wrapper (mount profile round 30). `when`
          // returns the row itself and the wrapper reads Show's narrowed
          // accessor: one row resolution per row, not a second memo in the
          // wrapper (audit C9).
          const visibleRow = () => {
            const node = nodeLookup.get(nodeId);
            return node !== undefined && !node.hidden ? node : undefined;
          };
          return (
            <Show when={visibleRow()}>
              {(node) => (
                <NodeWrapper
                  node={node}
                  resizeObserver={resizeObserver}
                  nodeClickDistance={props.nodeClickDistance}
                  events={props}
                />
              )}
            </Show>
          );
        }}
      </For>
    </div>
  );
};
