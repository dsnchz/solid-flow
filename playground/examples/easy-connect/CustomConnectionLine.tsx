import { type ConnectionLineComponentProps, getStraightPath } from "@/index";

export default function CustomConnectionLine(props: ConnectionLineComponentProps) {
  const edgePath = () => {
    const [path] = getStraightPath({
      sourceX: props.fromX,
      sourceY: props.fromY,
      targetX: props.toX,
      targetY: props.toY,
    });
    return path;
  };

  return (
    <g>
      <path style={props.connectionLineStyle} fill="none" d={edgePath()} />
      <circle cx={props.toX} cy={props.toY} fill="black" r={3} stroke="black" stroke-width={1.5} />
    </g>
  );
}
