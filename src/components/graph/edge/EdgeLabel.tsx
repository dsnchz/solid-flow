import { type Component, type JSX } from "solid-js";

import { useHandleEdgeSelect } from "@/hooks/useHandleEdgeSelect";

import EdgeLabelRenderer from "./EdgeLabelRenderer";
import type { BaseEdgeProps } from "./types";
import { useEdgeId } from "@/components/contexts";

type EdgeLabelProps = {
  readonly style?: BaseEdgeProps["labelStyle"];
  readonly x?: BaseEdgeProps["labelX"];
  readonly y?: BaseEdgeProps["labelY"];
  readonly children: JSX.Element;
};

const EdgeLabel: Component<EdgeLabelProps> = (props) => {
  const id = useEdgeId();
  const handleEdgeSelect = useHandleEdgeSelect();

  return (
    <EdgeLabelRenderer>
      <div
        class="solid-flow__edge-label"
        style={{
          transform: `translate(-50%, -50%) translate(${props.x}px,${props.y}px)`,
          "pointer-events": "all",
          ...(props.style ? props.style : {}),
        }}
        role="button"
        tabIndex={-1}
        onKeyUp={() => {}}
        onClick={() => {
          const edgeId = id();
          if (edgeId) handleEdgeSelect(edgeId);
        }}
      >
        {props.children}
      </div>
    </EdgeLabelRenderer>
  );
};

export default EdgeLabel;
