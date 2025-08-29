import { Show } from "solid-js";

import { type EdgeProps, getStraightPath, useInternalNode } from "@/index";

import { getEdgeParams } from "./utils";

export default function FloatingEdge(props: EdgeProps) {
  const sourceNode = useInternalNode(() => props.source);
  const targetNode = useInternalNode(() => props.target);

  const edgePath = () => {
    const src = sourceNode();
    const tgt = targetNode();

    if (!src || !tgt) return null;

    const { sx, sy, tx, ty } = getEdgeParams(src, tgt);

    const [path] = getStraightPath({
      sourceX: sx,
      sourceY: sy,
      targetX: tx,
      targetY: ty,
    });

    return path;
  };

  return (
    <Show when={edgePath()}>
      {(path) => (
        <path
          id={props.id}
          class="solid-flow__edge-path"
          d={path()}
          marker-end={props.markerEnd}
          style={props.style}
        />
      )}
    </Show>
  );
}
