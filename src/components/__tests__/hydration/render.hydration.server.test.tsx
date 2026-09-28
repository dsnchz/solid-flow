import { mkdirSync, writeFileSync } from "node:fs";

import { renderToString } from "@solidjs/web";
import { describe, expect, it } from "vitest";

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

  for (const make of scenarios) {
    const scenario = make();
    it(scenario.name, () => {
      const html = renderToString(() => <scenario.App />);
      // Every node and both edges are in the markup, with hydration keys.
      expect(html.match(/class="solid-flow__node /g)?.length).toBe(3);
      expect(html.match(/<g data-id="e\d"/g)?.length).toBe(2);
      expect(html).toContain("_hk=");
      writeFileSync(artifactPath(scenario.name), html);
    });
  }
});
