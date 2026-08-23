import { type Accessor, createContext, useContext } from "solid-js";

export const EdgeIdContext = createContext<Accessor<string> | null>(null);

/**
 * Returns the id of the edge this component is rendered inside. Available
 * anywhere in a custom edge's subtree (provided by the edge wrapper), so
 * nested components — like a custom edge label — can learn their host edge
 * without prop drilling.
 *
 * @public
 * @returns a reactive accessor for the surrounding edge's id
 */
export function useEdgeId(): Accessor<string> {
  const ctx = useContext(EdgeIdContext);

  if (!ctx) {
    throw new Error(
      "solid-flow: useEdgeId must be called inside an edge component (anywhere under a custom edge's subtree)",
    );
  }

  return ctx;
}
