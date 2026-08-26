import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { MiniMap } from "@/plugins/minimap/MiniMap";
import type { Node } from "@/types";

const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

const nodes: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 },
  { id: "b", position: { x: 400, y: 300 }, data: {}, width: 100, height: 40 },
];

const viewBoxWith = async (offsetScale?: number) => {
  const { container, unmount } = render(() => (
    <SolidFlow nodes={nodes} edges={[]} width={800} height={600}>
      <MiniMap offsetScale={offsetScale} />
    </SolidFlow>
  ));
  await tick();
  const viewBox = container.querySelector(".solid-flow__minimap-svg")?.getAttribute("viewBox");
  unmount();
  return viewBox;
};

describe("MiniMap offsetScale (upstream parity)", () => {
  it("widens the viewBox padding with larger offsetScale", async () => {
    const dflt = await viewBoxWith(undefined);
    const wide = await viewBoxWith(25);
    expect(dflt).toBeTruthy();
    expect(wide).toBeTruthy();
    expect(wide).not.toBe(dflt);
    // Larger offset => larger viewBox width (index 2 of "x y w h").
    const w = (vb: string) => Number(vb.split(" ")[2]);
    expect(w(wide!)).toBeGreaterThan(w(dflt!));
  });

  it("default (5) matches the previous hardcoded behavior", async () => {
    const dflt = await viewBoxWith(undefined);
    const explicit = await viewBoxWith(5);
    expect(explicit).toBe(dflt);
  });
});
