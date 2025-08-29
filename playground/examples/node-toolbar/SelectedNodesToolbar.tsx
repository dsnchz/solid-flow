import { createMemo } from "solid-js";

import { NodeToolbar, useNodes } from "~/index";

export const SelectedNodesToolbar = () => {
  const nodes = useNodes();

  const selectedNodeIds = () =>
    nodes()
      .filter((node) => node.selected)
      .map((node) => node.id);

  const isVisible = createMemo(() => selectedNodeIds().length > 1);

  return (
    <NodeToolbar nodeId={selectedNodeIds()} isVisible={isVisible()}>
      <button>Selection action</button>
    </NodeToolbar>
  );
};
