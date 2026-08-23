import { useExampleParam } from "./exampleParam";
import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

import { useSolidFlow } from "@/index";

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
  const [example, setExample] = useExampleParam();
  const { flow } = useSolidFlow();

  const exampleKey = () => (example() as keyof typeof SolidFlowExamplesMap) || "Overview";

  return (
    <header style={HEADER_STYLE}>
      <div style={{ "margin-right": "1rem", "font-weight": "700" }}>Solid Flow</div>
      <select
        value={exampleKey()}
        style={{
          "margin-right": "1rem",
        }}
        onChange={(event) => {
          setExample(event.target.value);
        }}
      >
        <For each={EXAMPLE_KEYS}>
          {(exampleKey) => <option value={exampleKey}>{exampleKey}</option>}
        </For>
      </select>
      <div style={{ "margin-left": "auto", display: "flex", gap: "1rem" }}>
        <div>Nodes: {flow.nodes.length}</div>
        <div>Edges: {flow.edges.length}</div>
      </div>
    </header>
  );
};
