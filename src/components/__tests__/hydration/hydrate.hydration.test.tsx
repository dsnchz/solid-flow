import { existsSync, readFileSync } from "node:fs";

import { fireEvent } from "@solidjs/testing-library";
import { hydrate } from "@solidjs/web";
import { flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { artifactPath } from "./artifacts";
import { scenarios } from "./scenarios";

/**
 * Client half of the hydration lane (vite.config.hydration.ts): hydrates the
 * markup render.hydration.server.test.tsx wrote, with the hydratable client
 * build of the same source. The invariants, after Solid's own hydration
 * parity harness:
 *
 * 1. Hydration neither throws nor warns (the dev runtime warns on a claim
 *    mismatch and on server nodes left unclaimed, and throws when it would
 *    have to create DOM). The by-design dev diagnostics are not warnings
 *    about hydration and are filtered (mountDiagnostics.test.tsx pins them).
 * 2. Every node and edge element the server rendered is the element the
 *    client ends up with — claimed, never re-created — after hydration,
 *    after the measurement pass, and after a state update; and hydration
 *    creates no DOM of its own (empty text nodes excepted, see below).
 * 3. The update lands in those elements, and a click selects a node: the
 *    hydrated flow is live, not a static shell.
 */
const BY_DESIGN_DIAGNOSTIC =
  /^\[WIDE_SCOPE_DEPS\] (memo "resolvedEdges\.row"|effect "div\.data-id, div\.class)/;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadArtifact = (name: string): string => {
  const file = artifactPath(name);
  if (!existsSync(file)) {
    throw new Error(
      `Missing server markup for "${name}": run the server half first (bun run test:hydration).`,
    );
  }
  return readFileSync(file, "utf-8");
};

const allNodes = (root: Node): Node[] => {
  const out: Node[] = [];
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      out.push(c);
      walk(c);
    }
  };
  walk(root);
  return out;
};

const rows = (container: HTMLElement) => [
  ...container.querySelectorAll(".solid-flow__node, .solid-flow__edge"),
];

describe("hydration lane — client hydrate", () => {
  let dispose: (() => void) | undefined;
  let container: HTMLDivElement | undefined;
  afterEach(async () => {
    dispose?.();
    dispose = undefined;
    await sleep(0);
    container?.remove();
  });

  for (const make of scenarios) {
    const scenario = make();
    it(scenario.name, async () => {
      const html = loadArtifact(scenario.name);
      const current = document.createElement("div");
      container = current;
      document.body.appendChild(current);
      // The bootstrap the hydration script would install in a real page.
      Reflect.set(globalThis, "_$HY", { events: [], completed: new WeakSet(), r: {}, fe() {} });
      current.innerHTML = html;
      const serverNodes = new Set(allNodes(current));
      const serverRows = rows(current);
      expect(serverRows).toHaveLength(5);

      const warn = vi.spyOn(console, "warn");
      const error = vi.spyOn(console, "error");
      try {
        dispose = hydrate(() => <scenario.App />, current);
        flush();
        // hydration completes on a microtask
        await sleep(10);
        flush();

        // (2) claimed, not re-created: nothing the client holds is new, except
        // EMPTY text nodes — the runtime adds one where a falsy <Show> sits
        // beside siblings (Zoom's pan cover, the edge list's marker defs); a
        // pure-Solid case reproduces it (.agent/spikes/p55-hydration).
        const created = allNodes(current).filter(
          (n) => !serverNodes.has(n) && !(n.nodeType === 3 && n.nodeValue === ""),
        );
        expect(
          created.map((n) => {
            const what =
              n.nodeType === 3 ? `text "${n.nodeValue}"` : `<${(n as Element).localName}>`;
            const parent = n.parentElement;
            return `${what} in <${parent?.localName} class="${parent?.getAttribute("class") ?? ""}">`;
          }),
          "client-created DOM right after hydration",
        ).toEqual([]);
        expect(rows(current)).toEqual(serverRows);

        // the measurement pass (idle) and the settle flushes
        await sleep(100);
        flush();
        expect(rows(current)).toEqual(serverRows);

        // (3) a state update lands in the server-rendered elements
        scenario.update();
        flush();
        await sleep(20);
        flush();
        expect(current.textContent).toContain(scenario.updatedText);
        expect(rows(current)).toEqual(serverRows);

        // ...and the flow is interactive
        const clicked = current.querySelector<HTMLElement>(
          `.solid-flow__node[data-id="${scenario.clickNodeId}"]`,
        )!;
        fireEvent.click(clicked);
        flush();
        expect(clicked.classList.contains("selected")).toBe(true);

        // (1) no hydration warnings, no errors
        const warnings = warn.mock.calls
          .map((args) => String(args[0]))
          .filter((message) => !BY_DESIGN_DIAGNOSTIC.test(message));
        expect(warnings).toEqual([]);
        expect(error.mock.calls.map((args) => String(args[0]))).toEqual([]);
      } finally {
        warn.mockRestore();
        error.mockRestore();
      }
    });
  }
});
