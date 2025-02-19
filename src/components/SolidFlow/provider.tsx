import { onCleanup, type ParentComponent } from "solid-js";

import { createSolidFlow } from "@/data/createSolidFlow";

import { SolidFlowContext } from "../contexts/flow";
import type { SolidFlowProps } from "./types";

const SolidFlowProvider: ParentComponent<Partial<SolidFlowProps>> = (props) => {
  const flowStore = createSolidFlow(props);
  const { reset } = flowStore;

  onCleanup(() => {
    reset();
  });

  return <SolidFlowContext.Provider value={flowStore}>{props.children}</SolidFlowContext.Provider>;
};

export default SolidFlowProvider;
