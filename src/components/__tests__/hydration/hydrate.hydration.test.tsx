import { existsSync, readFileSync } from "node:fs";

import { fireEvent } from "@solidjs/testing-library";
import { hydrate, render } from "@solidjs/web";
import { flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { settle } from "@/__tests__/settle";

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
 *    have to create DOM), and no other dev diagnostic fires either.
 * 2. Every node and edge element the server rendered is the element the
 *    client ends up with — claimed, never re-created — after hydration,
 *    after the measurement pass, and after a state update; and hydration
 *    creates no DOM of its own (empty text nodes excepted, see below).
 * 3. The update lands in those elements, and a click selects a node: the
 *    hydrated flow is live, not a static shell.
 * 4. Extra attributes given to library elements (Handle, BaseEdge, the
 *    resize controls) are in the server markup, the hydrated element keeps
 *    exactly the attributes the server rendered, and a fresh client render
 *    gives the same ones: the client adds the extras from a ref and the
 *    server from its own copy of the element, so this is what keeps the two
 *    copies in step.
 * 5. Under onlyRenderVisibleElements the server renders every row (no
 *    viewport) and hydration claims them all; once settled the client drops
 *    exactly the off-screen row, keeps every other claimed element, and
 *    mounts the dropped row again when it comes on screen.
 */

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

// Every attribute of an element except the hydration key. What the client
// legitimately changes after hydration is normalized: a path's `d` follows
// measured geometry (only its presence is compared), d3-drag (XYResizer)
// sets `touch-action` on its element, and the server and the DOM serialize
// `style` differently (compared per declaration).
const normalizeStyle = (style: string) =>
  style
    .split(";")
    .map((declaration) => declaration.split(":").map((part) => part.trim()))
    .filter(([property]) => property && property !== "touch-action")
    .map(([property, value]) => `${property}:${value}`)
    .sort()
    .join(";");

const attributesOf = (el: Element) =>
  Object.fromEntries(
    Array.from(el.attributes)
      .filter((a) => a.name !== "_hk")
      .map((a) => [
        a.name,
        a.name === "d" ? "<path>" : a.name === "style" ? normalizeStyle(a.value) : a.value,
      ]),
  );

const extrasSnapshot = (container: HTMLElement, selectors: readonly string[]) =>
  selectors.map((selector) => ({
    selector,
    elements: Array.from(container.querySelectorAll(selector)).map(attributesOf),
  }));

const rows = (container: HTMLElement) => [
  ...container.querySelectorAll(".solid-flow__node, .solid-flow__edge"),
];

describe("hydration lane — client hydrate", () => {
  let dispose: (() => void) | undefined;
  let container: HTMLDivElement | undefined;
  afterEach(async () => {
    dispose?.();
    dispose = undefined;
    await settle();
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
      // (4) extra attributes: rendered by the server, kept as is by the client
      const serverExtras = extrasSnapshot(current, scenario.extras ?? []);
      for (const { selector, elements } of serverExtras) {
        expect(elements.length, `server markup has ${selector}`).toBeGreaterThan(0);
      }

      const warn = vi.spyOn(console, "warn");
      const error = vi.spyOn(console, "error");
      try {
        dispose = hydrate(() => <scenario.App />, current);
        flush();
        // hydration completes on a microtask
        await Promise.resolve();
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

        // the measurement pass (idle) and the settle flushes; the unmount
        // tier drops its off-screen row then, and only that one
        await settle();
        const offScreenId = scenario.offScreen?.id;
        const keptRows = serverRows.filter((row) => row.getAttribute("data-id") !== offScreenId);
        if (offScreenId) expect(keptRows).toHaveLength(serverRows.length - 1);
        expect(rows(current)).toEqual(keptRows);

        // (3) a state update lands in the server-rendered elements
        scenario.update();
        flush();
        expect(current.textContent).toContain(scenario.updatedText);
        expect(rows(current)).toEqual(keptRows);
        expect(extrasSnapshot(current, scenario.extras ?? [])).toEqual(serverExtras);

        // ...and the flow is interactive
        const clicked = current.querySelector<HTMLElement>(
          `.solid-flow__node[data-id="${scenario.clickNodeId}"]`,
        )!;
        fireEvent.click(clicked);
        flush();
        expect(clicked.classList.contains("selected")).toBe(true);

        // (5) the unmount tier stays live after hydration: the dropped row
        // mounts again when it comes on screen, beside the claimed rows
        if (scenario.offScreen) {
          scenario.offScreen.bringBack();
          await settle();
          const back = current.querySelector(
            `.solid-flow__node[data-id="${scenario.offScreen.id}"]`,
          );
          expect(back?.textContent).toContain(scenario.offScreen.text);
          for (const row of keptRows) expect(rows(current)).toContain(row);
        }

        // (1) no hydration warnings, no errors
        expect(warn.mock.calls.map((args) => String(args[0]))).toEqual([]);
        expect(error.mock.calls.map((args) => String(args[0]))).toEqual([]);
      } finally {
        warn.mockRestore();
        error.mockRestore();
      }
    });

    // (4) continued: hydration does not re-apply a template's static
    // attributes, so the hydrated element cannot show an attribute the
    // server's copy left out. A fresh client render of the same scenario can:
    // it is the client copy, compared with the server's markup.
    if (scenario.extras) {
      it(`${scenario.name}: a client render gives the server's attributes`, async () => {
        const selectors = scenario.extras ?? [];
        const server = document.createElement("div");
        server.innerHTML = loadArtifact(scenario.name);
        const fresh = document.createElement("div");
        container = fresh;
        document.body.appendChild(fresh);
        const { App } = make();
        dispose = render(() => <App />, fresh);
        await settle();
        expect(extrasSnapshot(fresh, selectors)).toEqual(extrasSnapshot(server, selectors));
      });
    }
  }
});
