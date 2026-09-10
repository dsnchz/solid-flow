import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { Node, NodeProps } from "@/types";

import { SolidFlow } from "../../SolidFlow";
import { Handle } from "../Handle";

// Pins Handle's prop surface (defaults and attribute pass-through); the
// per-instance defaults refactor tried in bench round 25 measured at parity
// and was reverted, the pin stays.
const Custom = (_props: NodeProps) => (
  <>
    <Handle type="source" position="bottom" data-testid="plain" />
    <Handle
      type="target"
      position="left"
      isConnectableStart={false}
      data-testid="custom"
      title="hello"
      class="extra"
      style={{ color: "red" }}
    />
  </>
);
const nodes: Node[] = [
  { id: "a", type: "custom", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
];

describe("Handle props", () => {
  it("applies defaults and passes extra attributes through to the element", () => {
    const r = render(() => (
      <SolidFlow defaultNodes={nodes} nodeTypes={{ custom: Custom }} width={800} height={600} />
    ));
    flush();
    const plain = r.getByTestId("plain");
    expect(plain.classList.contains("solid-flow__handle-bottom")).toBe(true);
    expect(plain.classList.contains("source")).toBe(true);
    expect(plain.classList.contains("connectablestart")).toBe(true);
    expect(plain.classList.contains("connectableend")).toBe(true);
    expect(plain.getAttribute("data-handlepos")).toBe("bottom");
    expect(plain.getAttribute("data-id")).toBe(
      `${plain.getAttribute("data-id")!.split("-")[0]}-a-null-source`,
    );

    const custom = r.getByTestId("custom");
    expect(custom.classList.contains("solid-flow__handle-left")).toBe(true);
    expect(custom.classList.contains("target")).toBe(true);
    expect(custom.classList.contains("connectablestart")).toBe(false);
    expect(custom.classList.contains("extra")).toBe(true);
    expect(custom.getAttribute("title")).toBe("hello");
    expect(custom.style.color).toBe("red");
    expect(custom.getAttribute("role")).toBe("button");
  });
});
