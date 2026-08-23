import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "~/components/SolidFlow";

import { Background } from "./Background";

const renderBackground = (variant: "dots" | "lines" | "cross") => {
  const result = render(() => (
    <SolidFlow nodes={[]} edges={[]} width={800} height={600}>
      <Background variant={variant} />
    </SolidFlow>
  ));
  return result.container.querySelector(".solid-flow__background-pattern");
};

describe("Background", () => {
  it("cross variant draws with its per-variant default size (regression: issue #14)", () => {
    // A flat `size: 1` prop default used to preempt DEFAULT_SIZE.cross (6),
    // shrinking the cross to an invisible ~1px speck.
    const pattern = renderBackground("cross");
    expect(pattern?.getAttribute("d")).toBe("M3 0 V6 M0 3 H6");
  });

  it("lines variant spans the full gap tile", () => {
    const pattern = renderBackground("lines");
    expect(pattern?.getAttribute("d")).toBe("M10 0 V20 M0 10 H20");
  });

  it("dots variant renders the dot pattern", () => {
    const pattern = renderBackground("dots");
    expect(pattern?.tagName.toLowerCase()).toBe("circle");
  });
});
