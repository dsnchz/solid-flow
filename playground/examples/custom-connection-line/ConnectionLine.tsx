import { getBezierPath } from "@xyflow/system";
import { Show } from "solid-js";

import { useConnection } from "@/index";

export const ConnectionLine = () => {
  const connection = useConnection();

  const path = () => {
    const _connection = connection();

    if (!_connection.inProgress) return undefined;

    const { from, to, fromPosition, toPosition } = _connection;

    const [path] = getBezierPath({
      sourceX: from.x,
      sourceY: from.y,
      targetX: to.x,
      targetY: to.y,
      sourcePosition: fromPosition,
      targetPosition: toPosition,
    });

    return path;
  };

  return (
    <Show when={connection().inProgress}>
      <path d={path()} fill="none" stroke={connection().fromHandle?.id ?? undefined} />
    </Show>
  );
};
