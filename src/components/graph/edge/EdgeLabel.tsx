import clsx from "clsx";
import type { JSX, ParentProps } from "solid-js";
import { mergeProps, splitProps } from "solid-js";

import { useEdgeId, useInternalSolidFlow } from "@/components/contexts";
import { toPxString } from "@/utils";

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

export const EdgeLabel = (props: ParentProps<EdgeLabelProps>) => {
  const _props = mergeProps(
    {
      x: 0,
      y: 0,
      selectEdgeOnClick: false,
      transparent: false,
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const [local, rest] = splitProps(_props, [
    "x",
    "y",
    "width",
    "height",
    "selectEdgeOnClick",
    "transparent",
    "children",
    "class",
    "style",
  ]);

  const { actions, store } = useInternalSolidFlow();

  const id = useEdgeId();

  const zIndex = () => store.visibleEdgesMap.get(id())?.zIndex;

  return (
    <EdgeLabelRenderer>
      <div
        role="button"
        tabIndex={-1}
        class={clsx("solid-flow__edge-label", { transparent: local.transparent }, local.class)}
        style={{
          // TODO: Add hideOnSSR
          "pointer-events": "all",
          width: toPxString(local.width),
          height: toPxString(local.height),
          transform: `translate(-50%, -50%) translate(${local.x}px,${local.y}px)`,
          cursor: local.selectEdgeOnClick ? "pointer" : undefined,
          "z-index": zIndex(),
          ...local.style,
        }}
        onClick={() => {
          if (local.selectEdgeOnClick) actions.handleEdgeSelection(id());
        }}
        {...rest}
      >
        {local.children}
      </div>
    </EdgeLabelRenderer>
  );
};
