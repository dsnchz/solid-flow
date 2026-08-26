import { createSignal } from "solid-js";

/**
 * Renderer-local focus tracking for the unmount tier's focus guard (shared
 * by NodeRenderer and EdgeRenderer — audit C2c): focusin bubbles from any
 * descendant of a row, so the container-level pair of handlers tracks which
 * element's row currently holds DOM focus.
 */
export const createFocusedIdTracker = () => {
  const [focusedId, setFocusedId] = createSignal<string | null>(null);

  const onFocusIn = (event: FocusEvent) => {
    const element = (event.target as Element).closest("[data-id]");
    setFocusedId(element?.getAttribute("data-id") ?? null);
  };

  const onFocusOut = () => setFocusedId(null);

  return { focusedId, onFocusIn, onFocusOut } as const;
};
