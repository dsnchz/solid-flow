import "@/styles/style.css";

import { Errored } from "solid-js";
import { Dynamic } from "@solidjs/web";

import { SolidFlowProvider } from "@/index";

import { AppStateBar } from "./AppStateBar";
import { SolidFlowExamplesMap } from "./constants";
import ErrorPage from "./ErrorPage";
import { useExampleParam } from "./exampleParam";

export const App = () => {
  return (
    <Errored
      fallback={(e: () => unknown, r: () => void) => <ErrorPage error={e() as Error} reset={r} />}
    >
      <SolidFlowProvider>
        <AppContent />
      </SolidFlowProvider>
    </Errored>
  );
};

const AppContent = () => {
  const [example] = useExampleParam();
  const exampleKey = () => (example() as keyof typeof SolidFlowExamplesMap) || "Overview";

  return (
    <div style={{ display: "flex", "flex-direction": "column", width: "100vw", height: "100vh" }}>
      <AppStateBar />
      <Dynamic component={SolidFlowExamplesMap[exampleKey()]} />
    </div>
  );
};
