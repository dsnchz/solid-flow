import { fireEvent } from "@solidjs/testing-library";
import { expect } from "vitest";

/**
 * Shared jsdom gesture harness for connection drags.
 *
 * jsdom has no `elementFromPoint`; XYHandle uses it to find the handle under
 * the cursor while connecting, so tests must point it at the drop target for
 * the duration of the gesture. Call `restoreElementFromPoint` in `afterEach`.
 */
const documentPrototype = Object.getPrototypeOf(document) as Document;

export const restoreElementFromPoint = () => {
  delete (documentPrototype as { elementFromPoint?: unknown }).elementFromPoint;
};

/** Drags from `fromNodeId`'s source handle onto `toNodeId`'s target handle. */
export const connectByDrag = async (
  container: HTMLElement,
  { fromNodeId = "a", toNodeId = "b" }: { fromNodeId?: string; toNodeId?: string } = {},
) => {
  const sourceHandle = container.querySelector<HTMLElement>(
    `.solid-flow__handle.source[data-nodeid="${fromNodeId}"]`,
  )!;
  const targetHandle = container.querySelector<HTMLElement>(
    `.solid-flow__handle.target[data-nodeid="${toNodeId}"]`,
  )!;
  expect(sourceHandle).not.toBeNull();
  expect(targetHandle).not.toBeNull();

  documentPrototype.elementFromPoint = () => targetHandle;

  fireEvent.pointerDown(sourceHandle, { button: 0, pointerId: 1, clientX: 50, clientY: 40 });
  // two moves: the first exceeds the drag threshold and starts the
  // connection, the second hovers the drop target
  fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
  fireEvent.mouseMove(document, { clientX: 220, clientY: 100 });
  fireEvent.mouseUp(document, { clientX: 220, clientY: 100 });
  await new Promise((resolve) => setTimeout(resolve, 20));
};

/** Points jsdom's missing `elementFromPoint` at a fixed element (or nothing). */
export const stubElementFromPoint = (target: HTMLElement | null) => {
  documentPrototype.elementFromPoint = () => target;
};
