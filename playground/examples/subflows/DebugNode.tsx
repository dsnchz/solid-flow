import { Handle, type NodeProps } from "~/index";

export const DebugNode = (props: NodeProps) => {
  return (
    <>
      <Handle type="target" position="top" />
      <div>{props.id}</div>
      <div>
        x:{Math.round(props.positionAbsoluteX || 0)} y:{Math.round(props.positionAbsoluteY || 0)} z:
        {props.zIndex || 0}
      </div>
      <Handle type="source" position="bottom" />
    </>
  );
};
