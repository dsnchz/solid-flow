// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SolidFlowProps } from "../flowProps";
import { FLOW_PROP_KEYS } from "../flowProps";

// Compile-time completeness contract (audit 2026-08-24 A2): `satisfies` on
// FLOW_PROP_KEYS rejects keys that don't exist on SolidFlowProps; this type
// rejects keys that exist but are missing from the list. Together they make
// omit-list drift a tsc failure instead of a DOM-attribute leak.
type MissingFlowPropKeys = Exclude<keyof SolidFlowProps, (typeof FLOW_PROP_KEYS)[number]>;
type ExpectNever<T extends never> = T;
type _AllFlowPropsListed = ExpectNever<MissingFlowPropKeys>;
// Reference the alias so lint sees it used; the assertion is the line above.
const assertionHolds: _AllFlowPropsListed[] = [];

describe("FLOW_PROP_KEYS", () => {
  it("covers every SolidFlowProps key (the real check is at compile time)", () => {
    expect(assertionHolds).toHaveLength(0);
    expect(FLOW_PROP_KEYS.length).toBeGreaterThan(100);
    expect(new Set(FLOW_PROP_KEYS).size).toBe(FLOW_PROP_KEYS.length);
  });
});
