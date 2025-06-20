import "@/styles/style.css";

import { Route, Router, useSearchParams } from "@solidjs/router";
import { ErrorBoundary } from "solid-js";
import { Dynamic } from "solid-js/web";

import { SolidFlowProvider } from "@/components";

import { AppStateBar } from "./AppStateBar";
import { SolidFlowExamplesMap } from "./constants";
import ErrorPage from "./ErrorPage";

export const App = () => {
  return (
    <ErrorBoundary fallback={(e, r) => <ErrorPage error={e} reset={r} />}>
      <SolidFlowProvider>
        <Router>
          <Route path="/" component={AppContent} />
        </Router>
      </SolidFlowProvider>
    </ErrorBoundary>
  );
};

const AppContent = () => {
  const [searchParams] = useSearchParams();
  const exampleKey = () =>
    (searchParams.example as keyof typeof SolidFlowExamplesMap) || "Overview";

  return (
    <div style={{ display: "flex", "flex-direction": "column", width: "100vw", height: "100vh" }}>
      <AppStateBar />
      <Dynamic component={SolidFlowExamplesMap[exampleKey()]} />
    </div>
  );
};
