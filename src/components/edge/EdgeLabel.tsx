import type { JSX } from "@solidjs/web";
import type { ParentProps } from "solid-js";
import { omit } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/contexts";
import { propDefaults, toPxString } from "@/utils";

import { EdgeLabelRenderer } from "./EdgeLabelRenderer";

type EdgeLabelProps = {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly selectEdgeOnClick?: boolean;
  readonly transparent?: boolean;
  readonly style?: JSX.CSSProperties;
} & Omit<JSX.HTMLAttributes<HTMLDivElement>, "style">;

/** Renders an edge label positioned in graph coordinates. */
export const EdgeLabel = (props: ParentProps<EdgeLabelProps>): JSX.Element => {
  const _props = propDefaults(props, {
    x: 0,
    y: 0,
    selectEdgeOnClick: false,
    transparent: false,
    style: {} as JSX.CSSProperties,
  });

  const rest = omit(
    _props,
    "x",
    "y",
    "width",
    "height",
    "selectEdgeOnClick",
    "transparent",
    "children",
    "class",
    "style",
  );

  const { actions } = useInternalSolidFlow();

  const id = useEdgeId();

  const zIndex = () => actions.getLayoutedEdge(id())?.zIndex;

  return (
    <EdgeLabelRenderer>
      <div
        role="button"
        tabindex={-1}
        class={["solid-flow__edge-label", { transparent: _props.transparent }, _props.class]}
        style={{
          // TODO: Add hideOnSSR
          "pointer-events": "all",
          width: toPxString(_props.width),
          height: toPxString(_props.height),
          transform: `translate(-50%, -50%) translate(${_props.x}px,${_props.y}px)`,
          cursor: _props.selectEdgeOnClick ? "pointer" : undefined,
          "z-index": zIndex(),
          ..._props.style,
        }}
        onClick={() => {
          if (_props.selectEdgeOnClick) actions.handleEdgeSelection(id());
        }}
        {...rest}
      >
        {_props.children}
      </div>
    </EdgeLabelRenderer>
  );
};
