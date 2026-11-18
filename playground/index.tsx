import "./index.css";

import { render } from "@solidjs/web";

import { App } from "./App";

const root = document.getElementById("root");

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    "Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?",
  );
}

// `&css=base` loads base.css (structure + the minimal theme) and `&css=xy`
// xy-theme.css (base.css + the xyflow theme) instead of the full style.css,
// before the first render.
const css = new URLSearchParams(location.search).get("css");
if (css === "base") {
  await import("@/styles/base.css");
} else if (css === "xy") {
  await import("@/styles/xy-theme.css");
} else {
  await import("@/styles/style.css");
}

render(() => <App />, root!);
