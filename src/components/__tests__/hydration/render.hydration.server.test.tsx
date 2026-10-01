import { mkdirSync, writeFileSync } from "node:fs";

import { renderToString } from "@solidjs/web";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { artifactPath, artifactsDir } from "./artifacts";
import { scenarios } from "./scenarios";

/**
 * Server half of the hydration lane (vite.config.hydration-server.ts,
 * `generate: "ssr", hydratable: true`): renders every scenario and writes the
 * markup that hydrate.hydration.test.tsx hydrates with the client build of the same
 * source. `bun run test:hydration` runs this half first, so the artifacts are
 * always rendered from the current source.
 */
describe("hydration lane — server render", () => {
  mkdirSync(artifactsDir, { recursive: true });

  // A server render is pure (the lane runs the dev server build, so the
  // runtime's checks are on): it must not warn — a signal written on the
  // server (SERVER_WRITE) is deprecated and slated to become an error.
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  for (const make of scenarios) {
    const scenario = make();
    it(scenario.name, () => {
      const html = renderToString(() => <scenario.App />);
      expect(warn.mock.calls.map((args) => String(args[0]).split("\n")[0])).toEqual([]);
      // Every node and both edges are in the markup, with hydration keys.
      expect(html.match(/class="solid-flow__node /g)?.length).toBe(3);
      expect(html.match(/<g (?:_hk=\S+ )?data-id="e\d"/g)?.length).toBe(2);
      expect(html).toContain("_hk=");
      writeFileSync(artifactPath(scenario.name), html);
    });
  }
});
