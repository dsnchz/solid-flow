/**
 * The JSR stand-in for a stylesheet entry point. JSR exports JavaScript and
 * TypeScript modules only (a `.css` export fails the publish), so on JSR
 * `@dschz/solid-flow/style.css` (and `base.css`, `xy-theme.css`) is a module
 * that carries the stylesheet text and installs it once in the document
 * head: first, so the `xyflow` cascade layer is declared before the app's.
 * Without a document (server, Deno) it only exports the text. The `.css`
 * files themselves ship next to it for bundler aliases and `<link>` tags.
 *
 * Plain JavaScript: tsdown loads its config with Node's native import.
 *
 * @param {string} name the stylesheet's name, `style` for `style.css`
 * @param {string} css the bundled stylesheet text
 * @returns {{ js: string; dts: string }} the module and its declaration file
 */
export const stylesheetModule = (name, css) => ({
  js: [
    `// @ts-self-types="./${name}.css.d.ts"`,
    `/** The text of solid-flow's ${name}.css. */`,
    `export const css = ${JSON.stringify(css)};`,
    `const doc = globalThis.document;`,
    `if (doc && !doc.querySelector('style[data-solid-flow="${name}"]')) {`,
    `  const style = doc.createElement("style");`,
    `  style.setAttribute("data-solid-flow", "${name}");`,
    `  style.textContent = css;`,
    `  doc.head.prepend(style);`,
    `}`,
    ``,
  ].join("\n"),
  dts: [
    `/** The text of solid-flow's ${name}.css; importing the module installs it in the document head once. */`,
    `export declare const css: string;`,
    ``,
  ].join("\n"),
});
