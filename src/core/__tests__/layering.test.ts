// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// docs/ARCHITECTURE.md, Layers: src/core is the HEADLESS data graph, below
// the browser wiring and the render layer. Its modules import nothing from
// the layers above, and from @solidjs/web only types and `isServer` (a
// constant: no DOM, no render runtime).

const CORE = resolve(__dirname, "..");
const UPPER_LAYERS = /^@\/(components|browser|hooks|plugins|contexts|actions|utils)(\/|$)/;
/** Shared type declarations: the one place outside core a relative import may reach. */
const TYPES = resolve(CORE, "../types");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

/** Each import statement of a file: its specifier, and whether it is type-only. */
const importsOf = (source: string) =>
  [...source.matchAll(/^import\s+(type\s+)?([\s\S]*?)\s+from\s+"([^"]+)";/gm)].map((match) => ({
    typeOnly: !!match[1],
    clause: match[2]!,
    specifier: match[3]!,
  }));

const violations = () =>
  sourceFiles(CORE).flatMap((file) => {
    const name = relative(CORE, file);
    return importsOf(readFileSync(file, "utf8")).flatMap(({ typeOnly, clause, specifier }) => {
      if (UPPER_LAYERS.test(specifier)) return [`${name}: ${specifier}`];
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier);
        if (!target.startsWith(CORE) && !target.startsWith(TYPES)) return [`${name}: ${specifier}`];
      }
      if (specifier === "@solidjs/web" && !typeOnly) {
        const values = clause
          .replace(/[{}]/g, "")
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part && !part.startsWith("type ") && part !== "isServer");
        if (values.length > 0) return [`${name}: @solidjs/web { ${values.join(", ")} }`];
      }
      return [];
    });
  });

/** Runtime DOM access: frame/idle scheduling, the globals, layout reads. DOM TYPES are fine. */
const DOM_CALLS =
  /\b(requestAnimationFrame|cancelAnimationFrame|requestIdleCallback|getComputedStyle)\s*\(|\b(document|window)\s*\./g;

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const domCalls = () =>
  sourceFiles(CORE).flatMap((file) =>
    [...withoutComments(readFileSync(file, "utf8")).matchAll(DOM_CALLS)].map(
      (match) => `${relative(CORE, file)}: ${match[0]}`,
    ),
  );

describe("core layering", () => {
  it("finds the core sources", () => {
    expect(sourceFiles(CORE).map((file) => relative(CORE, file))).toContain("createFlowState.ts");
  });

  it("imports nothing from the layers above it", () => {
    expect(violations()).toEqual([]);
  });

  it("makes no DOM calls (the browser and render layers own the DOM)", () => {
    expect(domCalls()).toEqual([]);
  });
});
