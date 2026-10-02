// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// TypeScript attaches only the docblock nearest a declaration: a docblock
// followed directly by another one never reaches the editor or the d.ts.

const SRC = resolve(__dirname, "..");

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

const DOC_CLOSE = /\*\/\s*$/;
// `/**` then whitespace or end of line: banner rules (`/*****`) are not docblocks.
const DOC_OPEN = /^\s*\/\*\*(\s|$)/;

const stackedDocblocks = (source: string) =>
  source
    .split("\n")
    .flatMap((line, i, lines) =>
      i > 0 && DOC_OPEN.test(line) && DOC_CLOSE.test(lines[i - 1]!) ? [i + 1] : [],
    );

describe("docblocks", () => {
  it("each docblock sits on its declaration (none hides another)", () => {
    const found = sourceFiles(SRC).flatMap((file) =>
      stackedDocblocks(readFileSync(file, "utf8")).map((line) => `${relative(SRC, file)}:${line}`),
    );
    expect(found).toEqual([]);
  });

  it("finds a docblock followed by another, and skips banner rules", () => {
    expect(stackedDocblocks("/** a */\n/** b */\nconst x = 1;")).toEqual([2]);
    expect(stackedDocblocks("/**\n * a\n */\n/**\n * b\n */\nconst x = 1;")).toEqual([4]);
    expect(stackedDocblocks("/** a */\nconst x = 1;\n/** b */\nconst y = 2;")).toEqual([]);
    expect(stackedDocblocks("/*****/\n/*  Signals  */\n/*****/\nconst x = 1;")).toEqual([]);
  });
});
