// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");

describe("connection styles", () => {
  it("targets the connection-line svg with a proper class selector (regression: #18/#20)", () => {
    // A mangled bare `connectionline {` selector once left the svg with its
    // default overflow:hidden, clipping the in-progress line at flow-origin
    // and rendering it under nodes (no z-index).
    expect(css).toMatch(/\.solid-flow__connectionline\s*\{/);
    expect(css).not.toMatch(/(^|\s)connectionline\s*\{/m);
  });

  it("keeps overflow:visible on the connection-line rule", () => {
    const rule = css.split(".solid-flow__connectionline")[1]?.split("}")[0] ?? "";
    expect(rule).toContain("overflow: visible");
    expect(rule).toContain("z-index: 1001");
  });
});
