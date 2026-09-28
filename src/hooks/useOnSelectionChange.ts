import { useInternalSolidFlow } from "@/contexts";
import { createSelectionChange } from "@/core/selectionChange";
import type { Edge, Node, OnSelectionChange } from "@/types";

/**
 * Listens for selection changes from anywhere inside the flow: `onChange`
 * receives the selected nodes and edges once on mount, then whenever the
 * selected node or edge ids change. The listener is removed when the calling
 * component unmounts. The reactive counterparts are `useSelectedNodes` and
 * `useSelectedEdges`.
 *
 * @public
 * @param onChange - called with `{ nodes, edges }`
 * @example
 * useOnSelectionChange(({ nodes }) => setSearchParams({ node: nodes[0]?.id }));
 */
export function useOnSelectionChange<NodeType extends Node = Node, EdgeType extends Edge = Edge>(
  onChange: OnSelectionChange<NodeType, EdgeType>,
): void {
  const { store } = useInternalSolidFlow<NodeType, EdgeType>();
  createSelectionChange(
    () => ({ nodes: store.selectedNodes, edges: store.selectedEdges }),
    onChange,
  );
}
