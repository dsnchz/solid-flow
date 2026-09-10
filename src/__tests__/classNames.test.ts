import { describe, expect, it } from "vitest";

import { cx } from "@/utils";

// Per-row elements set their class as ONE string: @solidjs/web's array/object
// class form flattens and diffs a key map on every assignment (~200ms of a
// 10k mount, bench round 21); a string is a single attribute write.
describe("cx", () => {
  it("joins strings, drops falsy parts, and keeps truthy object keys", () => {
    expect(cx("a", "b")).toBe("a b");
    expect(cx("a", undefined, null, false, "", "b")).toBe("a b");
    expect(cx("a", { selected: true, dragging: false, nopan: 1 })).toBe("a selected nopan");
  });

  it("returns an empty string for no parts", () => {
    expect(cx()).toBe("");
    expect(cx(undefined, { x: false })).toBe("");
  });
});
