import type { JSX } from "@solidjs/web";
import { type EdgeToolbarBaseProps, getEdgeToolbarTransform } from "@xyflow/system";
import { getOwner, type ParentProps, Show } from "solid-js";

import { EdgeLabel } from "@/components/edge";
import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import { cx, extraKeysOf, spreadExtras } from "@/utils";

/** Props for the `EdgeToolbar` plugin. */
export type EdgeToolbarProps = EdgeToolbarBaseProps & {
  /** If `true`, clicking the toolbar selects the edge it belongs to. */
  readonly selectEdgeOnClick?: boolean;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/**
 * The props EdgeToolbar consumes itself plus the attributes it sets on its
 * element (an extra prop never overrides them); every other key is an
 * attribute of the element.
 */
const OWN_KEYS: ReadonlySet<string> = new Set([
  "x",
  "y",
  "alignX",
  "alignY",
  "isVisible",
  "selectEdgeOnClick",
  "class",
  "children",
  "style",
  "data-id",
]);

/**
 * The `<EdgeToolbar />` component renders a toolbar or tooltip for an edge.
 * It must be used inside a custom edge component. By default it is only
 * visible when the edge is selected; pass `isVisible` to control it manually.
 *
 * The toolbar does not scale with the viewport so that its content is always legible.
 */
export const EdgeToolbar = (props: ParentProps<EdgeToolbarProps>): JSX.Element => {
  // One per edge that carries it, hidden until shown: the extra attributes go
  // through spreadExtras (see Handle) instead of an omit record and a spread.
  const extraKeys = extraKeysOf(props, OWN_KEYS);
  const owner = getOwner();

  const { store, edgeLookup } = useInternalSolidFlow();

  const edgeId = useEdgeId();

  const isActive = () =>
    typeof props.isVisible === "boolean" ? props.isVisible : !!edgeLookup[edgeId()]?.selected;

  const transform = () =>
    getEdgeToolbarTransform(
      props.x,
      props.y,
      store.viewport.zoom,
      props.alignX ?? "center",
      props.alignY ?? "center",
    );

  return (
    <Show when={isActive()}>
      <EdgeLabel selectEdgeOnClick={props.selectEdgeOnClick} transparent>
        <div
          ref={(el) => spreadExtras(el, props, extraKeys, owner)}
          class={cx("solid-flow__edge-toolbar", props.class)}
          style={{
            position: "absolute",
            transform: transform(),
            "transform-origin": "0 0",
          }}
          data-id={edgeId()}
        >
          {props.children}
        </div>
      </EdgeLabel>
    </Show>
  );
};
