import type { JSX } from "@solidjs/web";
import type { PanelPosition } from "@xyflow/system";
import { omit, type ParentProps } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { propDefaults } from "@/utils";

export type PanelProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "style"> & {
  /** Set position of the panel
   * @example 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
   */
  readonly position?: PanelPosition;
  readonly style?: JSX.CSSProperties;
  readonly "data-testid"?: string;
  readonly "data-message"?: string;
};

/** Positioned overlay container for UI placed above the flow (used by `Controls`, `MiniMap`, attribution). */
export const Panel = (props: ParentProps<PanelProps>): JSX.Element => {
  const { store } = useInternalSolidFlow();

  const _props = propDefaults(props, {
    position: "top-right",
    style: {} as JSX.CSSProperties,
  });

  const rest = omit(_props, "class", "position", "style", "children");

  return (
    <div
      class={["solid-flow__panel", ..._props.position.split("-"), _props.class]}
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
