import { render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";
import type { ColorMode } from "@/types/system";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

// The OS preference is CSS's job (color-scheme + light-dark(), covered by
// e2e/color-scheme.spec.ts); the flow only marks a forced scheme.
describe("forceColorMode", () => {
  it("without it the container carries no scheme class, so the CSS follows the OS", async () => {
    const { getByTestId } = render(() => <SolidFlow nodes={nodes} width={800} height={600} />);
    await tick();
    const classes = getByTestId("solid-flow__wrapper").classList;
    expect(classes.contains("light")).toBe(false);
    expect(classes.contains("dark")).toBe(false);
  });

  it("marks the forced scheme and follows changes to it", async () => {
    const [mode, setMode] = createSignal<ColorMode | undefined>("dark");
    const { getByTestId } = render(() => (
      <SolidFlow nodes={nodes} width={800} height={600} forceColorMode={mode()} />
    ));
    await tick();
    const classes = getByTestId("solid-flow__wrapper").classList;
    expect(classes.contains("dark")).toBe(true);

    setMode("light");
    await tick();
    expect(classes.contains("light")).toBe(true);
    expect(classes.contains("dark")).toBe(false);

    setMode(undefined);
    await tick();
    expect(classes.contains("light")).toBe(false);
    expect(classes.contains("dark")).toBe(false);
  });
});
