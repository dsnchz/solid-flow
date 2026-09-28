// @vitest-environment node
// Compile-time contract for the color-scheme types (the @ts-expect-error
// annotations are the assertions, enforced by `tsc --noEmit` in the gate).
// The OS preference is CSS's job, so there is no "system" mode to name:
// `ColorMode` is the forceable scheme, as in @xyflow/system 1.x.
import { describe, expect, it } from "vitest";

import type { ColorMode, SolidFlowProps } from "@/index";

describe("ColorMode type contract", () => {
  it("is exactly the forceable schemes", () => {
    const modes: ColorMode[] = ["light", "dark"];
    // @ts-expect-error - "system" is not a mode: unset forceColorMode follows the OS
    const system: ColorMode = "system";
    expect([...modes, system]).toHaveLength(3);
  });

  it("types forceColorMode", () => {
    const props: SolidFlowProps = { forceColorMode: "dark" };
    const mode: ColorMode | undefined = props.forceColorMode;
    expect(mode).toBe("dark");
  });

  it("no longer exports ColorModeClass (ColorMode is the class)", () => {
    // @ts-expect-error - removed: ColorMode is already "light" | "dark"
    type Removed = import("@/index").ColorModeClass;
    const removed: Removed | undefined = undefined;
    expect(removed).toBeUndefined();
  });
});
