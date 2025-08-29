import { SolidFlowProvider } from "@/index";

import { AddNodeOnDropExample } from "./AddNodeOnDrop";

export const AddNodeOnDrop = () => {
  return (
    <SolidFlowProvider>
      <AddNodeOnDropExample />
    </SolidFlowProvider>
  );
};
