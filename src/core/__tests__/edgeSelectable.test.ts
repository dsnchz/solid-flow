// @vitest-environment node
import { describe, expect, it } from "vitest";

import { isEdgeSelectable } from "@/utils";

const store = (elementsSelectable: boolean, defaultSelectable?: boolean) => ({
  elementsSelectable,
  defaultEdgeOptions: defaultSelectable === undefined ? {} : { selectable: defaultSelectable },
});

describe("isEdgeSelectable (audit A7 — the single selectability rule)", () => {
  it("edge's own flag always wins", () => {
    expect(isEdgeSelectable({ selectable: true }, store(false, false))).toBe(true);
    expect(isEdgeSelectable({ selectable: false }, store(true, true))).toBe(false);
  });

  it("falls back to defaultEdgeOptions.selectable", () => {
    expect(isEdgeSelectable({}, store(true, false))).toBe(false);
    expect(isEdgeSelectable({}, store(false, true))).toBe(true);
  });

  it("falls back to elementsSelectable last — box selection must honor it", () => {
    expect(isEdgeSelectable({}, store(false))).toBe(false);
    expect(isEdgeSelectable({}, store(true))).toBe(true);
  });
});
