import { createSignal } from "solid-js";

// Minimal ?example= query-param signal — replaces @solidjs/router, whose 2.0
// API redesign is far more machinery than the playground needs.
const read = () => new URLSearchParams(window.location.search).get("example") ?? "";

const [example, setExampleSignal] = createSignal(read());

window.addEventListener("popstate", () => setExampleSignal(read()));

export const useExampleParam = (): [() => string, (name: string) => void] => [
  example,
  (name: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("example", name);
    window.history.pushState({}, "", url);
    setExampleSignal(name);
  },
];
