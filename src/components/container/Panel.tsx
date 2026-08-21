import type { JSX } from "@solidjs/web";
import type { PanelPosition } from "@xyflow/system";
import clsx from "clsx";
import { merge, omit, type ParentProps } from "solid-js";

import { useInternalSolidFlow } from "~/components/contexts";

export type PanelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  /** Set position of the panel
   * @example 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
   */
  readonly position?: PanelPosition;
  readonly style?: JSX.CSSProperties;
  readonly "data-testid"?: string;
  readonly "data-message"?: string;
};

export const Panel = (props: ParentProps<PanelProps>): JSX.Element => {
  const { store } = useInternalSolidFlow();

  const _props = merge(
    {
      position: "top-right",
      style: {} as JSX.CSSProperties,
    },
    props,
  );

  const rest = omit(_props, "class", "position", "style", "children");

  return (
    <div
      class={clsx(["solid-flow__panel", ..._props.position.split("-"), _props.class])}
      style={{
        "pointer-events": store.selectionRectMode ? "none" : undefined,
        ..._props.style,
      }}
      {...rest}
    >
      {_props.children}
    </div>
  );
};

export default Panel;
