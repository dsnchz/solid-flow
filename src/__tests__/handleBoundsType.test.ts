// @vitest-environment node
// Compile-time contract (enforced by `tsc --noEmit` in the gate): the
// measured handle geometry type is public under @xyflow/system 1.0's name,
// as React Flow 13 and Svelte Flow 2 export it, and it is the type the
// public connection-line props carry.
import { describe, expect, it } from "vitest";

import type { ConnectionLineComponentProps, HandleBounds } from "@/index";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

describe("HandleBounds type contract", () => {
  it("is the type of a connection line's fromHandle / toHandle", () => {
    const from: Equal<ConnectionLineComponentProps["fromHandle"], HandleBounds> = true;
    const to: Equal<ConnectionLineComponentProps["toHandle"], HandleBounds | null> = true;
    expect([from, to]).toEqual([true, true]);
  });

  it("describes a measured handle", () => {
    const handle: HandleBounds = {
      id: "out",
      nodeId: "a",
      type: "source",
      position: "right" as HandleBounds["position"],
      x: 142,
      y: 14,
      width: 8,
      height: 8,
    };
    expect(handle.type).toBe("source");
  });
});
