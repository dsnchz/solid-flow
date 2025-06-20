import type { PanelPosition } from "@xyflow/system";
import clsx from "clsx";
import { type JSX, mergeProps, type ParentProps, splitProps } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";

export type PanelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  /** Set position of the panel
   * @example 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
   */
  readonly position?: PanelPosition;
  readonly style?: JSX.CSSProperties;
  readonly "data-testid"?: string;
  readonly "data-message"?: string;
};

export const Panel = (props: ParentProps<PanelProps>) => {
  const { store } = useInternalSolidFlow();

  const _props = mergeProps(
    {
      position: "top-right",
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const [local, rest] = splitProps(_props, ["class", "position", "style", "children"]);

  return (
    <div
      class={clsx(["solid-flow__panel", ...local.position.split("-"), local.class])}
      style={{
        "pointer-events": store.selectionRectMode ? "none" : undefined,
        ...local.style,
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export default Panel;
