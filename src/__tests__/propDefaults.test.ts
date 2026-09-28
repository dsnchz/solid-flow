// @vitest-environment node
import { describe, expect, it } from "vitest";

import { propDefaults } from "../utils";

describe("propDefaults", () => {
  it("serves the prop when defined and the default otherwise", () => {
    const props: { position?: string; label?: string } = { label: "a" };
    const out = propDefaults(props, { position: "top-right", label: "default" });
    expect(out.position).toBe("top-right");
    expect(out.label).toBe("a");
  });

  it("reads each prop getter once per access", () => {
    // A JSX `children` getter instantiates the children on every read: a
    // second read renders them twice (a throwaway copy on every mount, and a
    // hydration key the server already spent). Found by the hydration lane.
    let reads = 0;
    const props = {
      get children() {
        reads++;
        return "child";
      },
    };
    const out = propDefaults(props, {});
    expect(out.children).toBe("child");
    expect(reads).toBe(1);
  });
});
