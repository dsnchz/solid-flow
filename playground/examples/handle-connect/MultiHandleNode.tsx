import { createEffect } from "solid-js";

import { type Connection, Handle, type NodeProps, useNodeConnections } from "@/index";

export const MultiHandleNode = (props: NodeProps) => {
  const onConnectTarget = (connection: Connection[]) => {
    console.log("connect target", connection);
  };

  const onConnectSource = (handleId: string, connection: Connection[]) => {
    console.log("connect source", handleId, connection);
  };

  const onDisconnectTarget = (connection: Connection[]) => {
    console.log("disconnect target", connection);
  };

  const onDisconnectSource = (handleId: string, connection: Connection[]) => {
    console.log("disconnect source", handleId, connection);
  };

  const connections = useNodeConnections(() => ({
    id: props.id,
    handleType: "target",
    // onConnect: (connections) => {
    //   console.log("onConnect", connections);
    // },
    // onDisconnect: (connections) => {
    //   console.log("onDisconnect", connections);
    // },
  }));

  createEffect(() => {
    console.log("connections:", connections());
  });

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
        id="a"
        type="source"
        position="right"
        onConnect={(connections) => onConnectSource("a", connections)}
        onDisconnect={(connections) => onDisconnectSource("a", connections)}
        class="source-a"
      />
      <Handle
        id="b"
        type="source"
        position="right"
        onConnect={(connections) => onConnectSource("b", connections)}
        onDisconnect={(connections) => onDisconnectSource("b", connections)}
        class="source-b"
      />
      <style>{`
        .custom {
          background-color: #333;
          padding: 10px;
          border-radius: 10px;
          color: #fff;
        }

        .custom .source-a {
          top: 5px;
          transform: translate(50%, 0);
        }

        .custom .source-b {
          bottom: 5px;
          top: auto;
          transform: translate(50%, 0);
        }
      `}</style>
    </div>
  );
};
