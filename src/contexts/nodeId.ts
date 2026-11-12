import { type Accessor, createContext, useContext } from "solid-js";

/**
 * The node a component renders inside: its id and whether it is
 * connectable. ONE provider per node (NodeWrapper): a provider is a root
 * plus two computeds per row, so the two values share it (#22).
 */
export type NodeContextValue = {
  readonly id: Accessor<string>;
  readonly connectable: Accessor<boolean>;
};

export const NodeContext = createContext<NodeContextValue | null>(null);

/**
 * Returns the id of the node this component is rendered inside. Available
 * anywhere in a custom node's subtree (provided by the node wrapper), so
 * nested components — like a custom `Handle` — can learn their host node
 * without prop drilling.
 *
 * @public
 * @returns a reactive accessor for the surrounding node's id
 */
export function useNodeId(): Accessor<string> {
  const ctx = useContext(NodeContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: useNodeId must be called inside a node component (anywhere under a custom node's subtree)",
    );
  }

  return ctx.id;
}
