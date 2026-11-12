// @vitest-environment node
import { createEffect, createRoot, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createReportedIds } from "../projections/reportedIds";

// The selected and unmeasured records are fed by the rows (#22): a report
// that flips an id wakes the membership readers and that id's own readers,
// and nothing else; a report that flips nothing wakes no one.
describe("createReportedIds", () => {
  it("follows the reports: membership in report order, per-id reads, silent non-flips", () => {
    const ids = createReportedIds("test");
    const { dispose, keysSeen, aSeen } = createRoot((dispose) => {
      const keysSeen: string[][] = [];
      const aSeen: boolean[] = [];
      createEffect(
        () => Object.keys(ids.record),
        (keys) => {
          keysSeen.push(keys);
        },
      );
      createEffect(
        () => "a" in ids.record,
        (present) => {
          aSeen.push(present);
        },
      );
      return { dispose, keysSeen, aSeen };
    });
    flush();
    expect(keysSeen).toEqual([[]]);
    expect(aSeen).toEqual([false]);

    ids.set("b", true);
    ids.set("a", true);
    flush();
    expect(keysSeen.at(-1)).toEqual(["b", "a"]);
    expect(aSeen).toEqual([false, true]);
    expect(ids.record.a).toEqual({ id: "a" });

    // a non-flip wakes nobody; another id's flip leaves the `a` reader alone
    const keyRuns = keysSeen.length;
    ids.set("a", true);
    flush();
    expect(keysSeen).toHaveLength(keyRuns);
    ids.set("b", false);
    flush();
    expect(keysSeen.at(-1)).toEqual(["a"]);
    expect(aSeen).toEqual([false, true]);

    ids.set("a", false);
    flush();
    expect(keysSeen.at(-1)).toEqual([]);
    expect(aSeen).toEqual([false, true, false]);
    expect(ids.record.a).toBeUndefined();
    dispose();
  });
});
