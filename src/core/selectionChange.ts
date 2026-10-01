import { createEffect, createMemo } from "solid-js";

import type { Edge, Node } from "@/types";

type SelectionParams<NodeType extends Node, EdgeType extends Edge> = {
  nodes: NodeType[];
  edges: EdgeType[];
};

const sameIds = (a: readonly { id: string }[], b: readonly { id: string }[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i]!.id);

/**
 * Calls `onChange` with the current selection, then again whenever the
 * selected node or edge ids change (a write that keeps the ids, such as a
 * data update on a selected node, is not a change). `selection` returns
 * `undefined` while nobody listens: the selection is then not read at all,
 * and a listener that arrives later starts with the selection as it is.
 * Owned by the calling scope: it stops when that scope is disposed. Backs
 * both the `onSelectionChange` prop and `useOnSelectionChange`.
 */
export const createSelectionChange = <NodeType extends Node, EdgeType extends Edge>(
  selection: () => SelectionParams<NodeType, EdgeType> | undefined,
  onChange: (params: SelectionParams<NodeType, EdgeType>) => void,
): void => {
  const selected = createMemo(selection, {
    equals: (a, b) =>
      a === b || (!!a && !!b && sameIds(a.nodes, b.nodes) && sameIds(a.edges, b.edges)),
    name: "selectionChange",
  });
  createEffect(selected, (params) => {
    if (params) onChange(params);
  });
};
