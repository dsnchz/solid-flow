import type { PanelPosition } from "@xyflow/system";
import clsx from "clsx";
import { type Component, type JSX } from "solid-js";

import { useFlowStore } from "@/components/contexts";

export type PanelProps = JSX.HTMLAttributes<HTMLDivElement> & {
  "data-testid"?: string;
  "data-message"?: string;
  /** Set position of the panel
   * @example 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
   */
  readonly position?: PanelPosition;
  readonly style?: JSX.CSSProperties;
  readonly class?: string;
};

const Panel: Component<PanelProps> = (props) => {
  const { store } = useFlowStore();
  const position = () => props.position || "top-right";
  const positionClasses = () => `${position()}`.split("-");

  return (
    <div
      class={clsx(["solid-flow__panel", props.class, ...positionClasses()])}
      style={{
        ...(props.style ?? {}),
        "pointer-events": store.selectionRectMode ? "none" : undefined,
      }}
    >
      {props.children}
    </div>
  );
};

export default Panel;
