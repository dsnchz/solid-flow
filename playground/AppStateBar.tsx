import { useSearchParams } from "@solidjs/router";
import { For, type JSX, Show } from "solid-js";

import { useFlowStore } from "@/components/contexts";

import { SolidFlowExamplesMap } from "./constants";

const EXAMPLE_KEYS = Object.keys(SolidFlowExamplesMap) as (keyof typeof SolidFlowExamplesMap)[];

type ExamplePickerProps = {
  readonly onChange: (exampleKey: keyof typeof SolidFlowExamplesMap) => void;
};

const CONTAINER_STYLE = {
  display: "flex",
  "flex-direction": "row",
  "align-items": "center",
  padding: "12px",
  width: "100%",
} as JSX.CSSProperties;

export const AppStateBar = (props: ExamplePickerProps) => {
  const [searchParams] = useSearchParams();
  const { store } = useFlowStore();

  return (
    <div id="app-state-bar" style={{ display: "flex", background: "#333", color: "white" }}>
      <div style={CONTAINER_STYLE}>
        <div id="example-picker-container">
          <label style={{ color: "#fff", "margin-right": "10px" }}>Example:</label>
          <select
            value={searchParams.example}
            style={{
              background: "#333",
              color: "#fff",
              border: "none",
              padding: "5px",
              width: "180px",
            }}
            onChange={(event) =>
              props.onChange(event.target.value as keyof typeof SolidFlowExamplesMap)
            }
          >
            <For each={EXAMPLE_KEYS}>
              {(exampleKey) => <option value={exampleKey}>{exampleKey}</option>}
            </For>
          </select>
        </div>
        <div
          id="app-state-container"
          style={{ display: "flex", gap: "12px", "margin-left": "auto" }}
        >
          <Show when={store.onlyRenderVisibleElements}>
            <div id="node-count">Visible Nodes: {store.visibleNodes.length}</div>
          </Show>
          <div id="node-count">Nodes: {store.nodes.length}</div>
          <div id="edge-count">Edges: {store.edges.length}</div>
        </div>
      </div>
    </div>
  );
};
