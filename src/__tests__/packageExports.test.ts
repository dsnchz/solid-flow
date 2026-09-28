// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf8")) as {
  exports: Record<string, unknown>;
  sideEffects: unknown;
  typesVersions?: unknown;
};

describe("package exports", () => {
  it('marks the stylesheets as side effects, so bundlers keep `import "…/style.css"`', () => {
    expect(pkg.sideEffects).toEqual(["*.css"]);
  });
});
