import { type EdgeToolbarBaseProps, getEdgeToolbarTransform } from "@xyflow/system";
import clsx from "clsx";
import { type JSX, type ParentProps, Show, splitProps } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "~/components/contexts";
import { EdgeLabel } from "~/components/graph/edge";

export type EdgeToolbarProps = EdgeToolbarBaseProps & {
  /** If `true`, clicking the toolbar selects the edge it belongs to. */
  readonly selectEdgeOnClick?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/**
 * The `<EdgeToolbar />` component renders a toolbar or tooltip for an edge.
 * It must be used inside a custom edge component. By default it is only
 * visible when the edge is selected; pass `isVisible` to control it manually.
 *
 * The toolbar does not scale with the viewport so that its content is always legible.
 */
export const EdgeToolbar = (props: ParentProps<EdgeToolbarProps>): JSX.Element => {
  const [local, rest] = splitProps(props, [
    "x",
    "y",
    "alignX",
    "alignY",
    "isVisible",
    "selectEdgeOnClick",
    "class",
    "children",
  ]);

  const { store, edgeLookup } = useInternalSolidFlow();

  const edgeId = useEdgeId();

  const isActive = () =>
    typeof local.isVisible === "boolean" ? local.isVisible : !!edgeLookup.get(edgeId())?.selected;

  const transform = () =>
    getEdgeToolbarTransform(
      local.x,
      local.y,
      store.viewport.zoom,
      local.alignX ?? "center",
      local.alignY ?? "center",
    );

  return (
    <Show when={isActive()}>
      <EdgeLabel selectEdgeOnClick={local.selectEdgeOnClick} transparent>
        <div
          class={clsx("solid-flow__edge-toolbar", local.class)}
          style={{
            position: "absolute",
            transform: transform(),
            "transform-origin": "0 0",
          }}
          data-id={edgeId()}
          {...rest}
        >
          {local.children}
        </div>
      </EdgeLabel>
    </Show>
  );
};
