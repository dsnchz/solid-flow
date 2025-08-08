import { For } from "solid-js";

import { Background, SolidFlow, SolidFlowProvider } from "../../../src";

type BackgroundProps = Parameters<typeof Background>[0];

const Flow = (props: { id: string; bgProps: BackgroundProps[] }) => {
  return (
    <SolidFlowProvider>
      <SolidFlow
        colorMode="dark"
        nodes={[
          {
            id: "1",
            data: { label: "Node 1" },
            position: { x: 50, y: 50 },
          },
        ]}
        id={props.id}
      >
        <For each={props.bgProps}>
          {(bgProps, idx) => <Background id={idx().toString()} {...bgProps} />}
        </For>
      </SolidFlow>
    </SolidFlowProvider>
  );
};

export const Backgrounds = () => (
  <>
    <style>{`
      .backgrounds-wrapper {
        display: flex;
        height: 100%;
      }
      
      .backgrounds-wrapper .solid-flow {
        width: 100%;
        height: 100%;
        border-right: 1px solid #ddd;
      }
    `}</style>
    <div class="backgrounds-wrapper">
      <Flow id="flow-a" bgProps={[{ variant: "dots" }]} />
      <Flow id="flow-b" bgProps={[{ variant: "lines", gap: [50, 50] }]} />
      <Flow id="flow-c" bgProps={[{ variant: "cross", gap: [100, 50] }]} />
      <Flow
        id="flow-d"
        bgProps={[
          { variant: "lines", gap: 10 },
          { variant: "lines", gap: 100, patternColor: "#ccc" },
        ]}
      />
    </div>
  </>
);
