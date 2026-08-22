import { type Connection, Handle, type NodeProps } from "@/index";

export const SingleHandleNode = (props: NodeProps) => {
  const onConnectTarget = (connection: Connection[]) => {
    console.log("connect target", connection);
  };

  const onConnectSource = (connection: Connection[]) => {
    console.log("connect source", connection);
  };

  const onDisconnectTarget = (connection: Connection[]) => {
    console.log("disconnect target", connection);
  };

  const onDisconnectSource = (connection: Connection[]) => {
    console.log("disconnect source", connection);
  };

  return (
    <div class="custom">
      <Handle
        type="target"
        position="left"
        onConnect={onConnectTarget}
        onDisconnect={onDisconnectTarget}
      />
      <div>node {props.id}</div>
      <Handle
        type="source"
        position="right"
        onConnect={onConnectSource}
        onDisconnect={onDisconnectSource}
      />
      <style>{`
        .custom {
          background-color: #333;
          padding: 10px;
          border-radius: 10px;
          color: #fff;
        }
      `}</style>
    </div>
  );
};
