// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf8")) as {
  exports: Record<string, unknown>;
  sideEffects: unknown;
  typesVersions?: unknown;
};

// The stylesheet entry points, as React Flow / Svelte Flow publish them
// (`./style.css`, `./base.css` and their `./dist/*` forms), plus our older
// `./styles` alias. The build writes the two files (tsdown.config.ts).
describe("package exports", () => {
  it("publishes style.css and base.css under upstream's paths", () => {
    expect(pkg.exports["./style.css"]).toBe("./dist/styles/style.css");
    expect(pkg.exports["./dist/style.css"]).toBe("./dist/styles/style.css");
    expect(pkg.exports["./base.css"]).toBe("./dist/styles/base.css");
    expect(pkg.exports["./dist/base.css"]).toBe("./dist/styles/base.css");
    expect(pkg.exports["./styles"]).toBe("./dist/styles/style.css");
  });

  it("declares no typesVersions (the stylesheets have no types)", () => {
    expect(pkg.typesVersions).toBeUndefined();
  });

  it("exposes package.json to tools, as upstream does", () => {
    expect(pkg.exports["./package.json"]).toBe("./package.json");
  });

  it('marks the stylesheets as side effects, so bundlers keep `import "…/style.css"`', () => {
    expect(pkg.sideEffects).toEqual(["*.css"]);
  });
});
