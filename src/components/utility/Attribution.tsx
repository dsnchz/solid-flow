import type { PanelPosition } from "@xyflow/system";
import { type Component, Show } from "solid-js";

import { Panel } from "@/components/container";
import type { ProOptions } from "@/types/system";

export type AttributionProps = {
  readonly proOptions: ProOptions;
  readonly position: PanelPosition;
};

export const Attribution: Component<Partial<AttributionProps>> = (props) => {
  return (
    <Show when={!props.proOptions?.hideAttribution}>
      <Panel
        position={props.position ?? "bottom-right"}
        class="solid-flow__attribution"
        data-message="Feel free to remove the attribution or check out how you could support us: https://solidflow.dev/support-us"
      >
        <a
          href="https://solidflow.dev"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Solid Flow attribution"
        >
          Solid Flow
        </a>
      </Panel>
    </Show>
  );
};
