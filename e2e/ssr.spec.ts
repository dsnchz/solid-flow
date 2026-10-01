import { centerOf, drag, expect, nodeById, test } from "./helpers";

// SSR smoke: a real server render (e2e/ssr, @solidjs/vite-plugin start mode
// with `ssr: true`: the page's markup comes from the server, with the
// hydration bootstrap script) hydrated by the real client bundle in a real
// browser. The jsdom hydration lane (bun run test:hydration) pins the
// mechanics; this pins what jsdom cannot: the bootstrap script, real layout
// and measurement, d3 gestures on hydrated elements.
const SSR = "http://localhost:3020/";

// The only dev diagnostics the page may print (docs/ARCHITECTURE.md): the
// by-design wide scopes, and the two machine-speed findings the drag below
// can trip on a slow runner: WASTED_RECOMPUTE on the row projections and the
// on-screen sweep memos (computes whose work is their writes and whose value
// is `undefined`, which the diagnostic always counts as unchanged:
// solidjs/solid#3715), and HOT_SCOPE_TIME on the row projections (the
// per-move row work crossing its time budget). Anything else (a hydration
// warning, a strict read, another scope, an error) fails.
const ALLOWED_WARNING = new RegExp(
  [
    String.raw`^\[WIDE_SCOPE_DEPS\]`,
    String.raw`^\[(WASTED_RECOMPUTE|HOT_SCOPE_TIME)\] memo "(internalNodes|resolvedEdges)\.row"`,
    String.raw`^\[WASTED_RECOMPUTE\] memo "onScreen(Node|Edge)Ids"`,
  ].join("|"),
);

test.describe("server-rendered flow", () => {
  test("the server sends the whole flow as markup", async ({ request }) => {
    const html = await (await request.get(SSR, { headers: { accept: "text/html" } })).text();
    expect(html).toContain("_$HY");
    expect(html.match(/class="solid-flow__node /g)?.length).toBe(3);
    expect(html.match(/<g (?:_hk=\S+ )?data-id="e\d"/g)?.length).toBe(2);
  });

  test("hydrates onto the server markup and stays interactive", async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") messages.push(message.text());
    });
    page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
    // Tag the server's elements before any script runs: after hydration the
    // flow must hold those same elements, not client-rendered replacements.
    await page.addInitScript(() => {
      document.addEventListener("readystatechange", () => {
        if (document.readyState !== "interactive") return;
        for (const el of document.querySelectorAll(".solid-flow__node, .solid-flow__edge")) {
          el.setAttribute("data-server", "");
        }
      });
    });

    await page.goto(SSR);
    await expect(nodeById(page, "mid")).toHaveCSS("visibility", "visible");
    // hydration and the measurement pass settle
    await page.waitForTimeout(300);

    const rows = page.locator(".solid-flow__node, .solid-flow__edge");
    await expect(rows).toHaveCount(5);
    await expect(
      page.locator(".solid-flow__node[data-server], .solid-flow__edge[data-server]"),
    ).toHaveCount(5);

    // a d3 drag on a hydrated node moves it, and its edge follows
    const edgePath = page.locator('.solid-flow__edge[data-id="e1"] .solid-flow__edge-path');
    const pathBefore = await edgePath.getAttribute("d");
    const before = await centerOf(nodeById(page, "in"));
    await drag(page, before, { x: before.x + 120, y: before.y + 30 });
    const after = await centerOf(nodeById(page, "in"));
    expect(after.x - before.x).toBeGreaterThan(80);
    expect(await edgePath.getAttribute("d")).not.toBe(pathBefore);

    // a click selects, and the controls work
    await nodeById(page, "out").click();
    await expect(nodeById(page, "out")).toHaveClass(/selected/);
    const viewport = page.locator(".solid-flow__viewport");
    const camera = await viewport.getAttribute("style");
    await page.locator(".solid-flow__controls-zoomin").click();
    await expect.poll(() => viewport.getAttribute("style")).not.toBe(camera);

    // still the server's elements, and nothing warned
    await expect(
      page.locator(".solid-flow__node[data-server], .solid-flow__edge[data-server]"),
    ).toHaveCount(5);
    expect(messages.filter((m) => !ALLOWED_WARNING.test(m))).toEqual([]);
  });
});
