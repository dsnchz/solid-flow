import { useSearchParams } from "@solidjs/router";
import { For, type JSX } from "solid-js";

import { useSolidFlow } from "~/index";

import { SolidFlowExamplesMap } from "./constants";

const EXAMPLE_KEYS = Object.keys(SolidFlowExamplesMap) as (keyof typeof SolidFlowExamplesMap)[];

const HEADER_STYLE = {
  padding: "10px",
  "border-bottom": "1px solid #eee",
  display: "flex",
  "font-weight": "700",
  "align-items": "center",
  color: "#111",
} as JSX.CSSProperties;

export const AppStateBar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getNodes, getEdges } = useSolidFlow();

  const exampleKey = () =>
    (searchParams.example as keyof typeof SolidFlowExamplesMap) || "Overview";

  return (
    <header style={HEADER_STYLE}>
      <div style={{ "margin-right": "1rem", "font-weight": "700" }}>Solid Flow</div>
      <select
        value={exampleKey()}
        style={{
          "margin-right": "1rem",
        }}
        onChange={(event) => {
          setSearchParams({ example: event.target.value });
        }}
      >
        <For each={EXAMPLE_KEYS}>
          {(exampleKey) => <option value={exampleKey}>{exampleKey}</option>}
        </For>
      </select>
      <div style={{ "margin-left": "auto", display: "flex", gap: "1rem" }}>
        <div>Nodes: {getNodes().length}</div>
        <div>Edges: {getEdges().length}</div>
      </div>
    </header>
  );
};
