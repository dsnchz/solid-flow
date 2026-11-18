import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { stylesheetModule } from "../../scripts/jsrStylesheetModule";

// What a JSR user gets from `import "@dschz/solid-flow/style.css"`: the
// module the build writes for JSR, loaded as a fresh module instance (its
// own directory each time, under the project so the module loader serves it).
const ROOT = join(import.meta.dirname, "../../tmp/jsr-stylesheet-module");
const load = async (name: string, css: string): Promise<{ css: string }> => {
  mkdirSync(ROOT, { recursive: true });
  const file = join(mkdtempSync(join(ROOT, "m-")), `${name}.css.js`);
  writeFileSync(file, stylesheetModule(name, css).js);
  return import(/* @vite-ignore */ file);
};

const installed = (name: string) =>
  document.head.querySelectorAll(`style[data-solid-flow="${name}"]`);

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.querySelectorAll("style[data-solid-flow]").forEach((el) => el.remove());
});

afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

describe("JSR stylesheet modules", () => {
  it("install the stylesheet once, first in the head, and export its text", async () => {
    const app = document.createElement("style");
    document.head.append(app);
    const css = '@layer xyflow { .solid-flow { content: "a\\"b"; } }';

    const mod = await load("style", css);
    expect(mod.css).toBe(css);
    expect(installed("style")).toHaveLength(1);
    expect(installed("style")[0]!.textContent).toBe(css);
    expect(document.head.firstElementChild).toBe(installed("style")[0]);

    // a second instance (HMR, two bundles) finds it and adds nothing
    await load("style", css);
    expect(installed("style")).toHaveLength(1);
    app.remove();
  });

  it("keep each stylesheet apart", async () => {
    await load("style", ".a {}");
    await load("xy-theme", ".b {}");
    expect(installed("style")).toHaveLength(1);
    expect(installed("xy-theme")).toHaveLength(1);
  });

  it("only export the text without a document (server, Deno)", async () => {
    vi.stubGlobal("document", undefined);
    const mod = await load("base", ".c {}");
    expect(mod.css).toBe(".c {}");
  });
});
