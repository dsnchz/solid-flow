import { render } from "@solidjs/testing-library";
import type { ColorMode } from "@xyflow/system";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import type { Node } from "@/types";

const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms));

const nodes: Node[] = [{ id: "a", position: { x: 0, y: 0 }, data: {}, width: 100, height: 40 }];

/** The OS color-scheme preference, as matchMedia reports it. */
const prefersColorScheme = (scheme: "dark" | "light") =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === `(prefers-color-scheme: ${scheme})`,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );

// The prop is left out entirely when no mode is given: the default is what
// is under test, not an explicit `undefined`.
const renderFlow = async (colorMode?: ColorMode) => {
  const { getByTestId } = render(() =>
    colorMode === undefined ? (
      <SolidFlow nodes={nodes} width={800} height={600} />
    ) : (
      <SolidFlow nodes={nodes} width={800} height={600} colorMode={colorMode} />
    ),
  );
  await tick();
  return getByTestId("solid-flow__wrapper").classList;
};

describe("colorMode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to 'system': a dark OS preference renders the dark theme", async () => {
    prefersColorScheme("dark");
    const classes = await renderFlow();
    expect(classes.contains("dark")).toBe(true);
    expect(classes.contains("light")).toBe(false);
  });

  it("defaults to 'system': a light OS preference renders the light theme", async () => {
    prefersColorScheme("light");
    const classes = await renderFlow();
    expect(classes.contains("light")).toBe(true);
    expect(classes.contains("dark")).toBe(false);
  });

  it("an explicit mode overrides the OS preference", async () => {
    prefersColorScheme("dark");
    const classes = await renderFlow("light");
    expect(classes.contains("light")).toBe(true);
    expect(classes.contains("dark")).toBe(false);
  });
});
