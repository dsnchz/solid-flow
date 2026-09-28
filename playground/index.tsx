import "./index.css";

import { render } from "@solidjs/web";

import { App } from "./App";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

// `&css=base` loads base.css (structure + the minimal theme) instead of the
// full style.css, before the first render.
if (new URLSearchParams(location.search).get("css") === "base") {
  await import("@/styles/base.css");
} else {
  await import("@/styles/style.css");
}

render(() => <App />, root!);
