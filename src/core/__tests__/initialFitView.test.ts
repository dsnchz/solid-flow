// @vitest-environment node
import { createRoot, createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { createInitialFitView } from "../initialFitView";

// The initial fitView needs the measured nodes (the first measuring pass)
// and a ready container (dimensions + pan-zoom). Their order is not
// guaranteed: whichever lands last fires it, once.

const setup = () => {
  const [ready, setReady] = createSignal(false);
  let fits = 0;
  let dispose!: () => void;
  let initialFitView!: ReturnType<typeof createInitialFitView>;
  createRoot((d) => {
    dispose = d;
    initialFitView = createInitialFitView({ ready, fitView: () => void fits++ });
  });
  flush();
  return { initialFitView, setReady, fits: () => fits, dispose };
};

describe("createInitialFitView", () => {
  it("fits once the container is ready after the nodes are measured", () => {
    const { initialFitView, setReady, fits, dispose } = setup();
    initialFitView.arm(true);
    initialFitView.markNodesMeasured();
    expect(fits()).toBe(0);

    setReady(true);
    flush();
    expect(fits()).toBe(1);
    dispose();
  });

  it("fits once the nodes are measured after the container is ready", () => {
    const { initialFitView, setReady, fits, dispose } = setup();
    initialFitView.arm(true);
    setReady(true);
    flush();
    expect(fits()).toBe(0);

    initialFitView.markNodesMeasured();
    expect(fits()).toBe(1);
    dispose();
  });

  it("fits only once", () => {
    const { initialFitView, setReady, fits, dispose } = setup();
    initialFitView.arm(true);
    setReady(true);
    flush();
    initialFitView.markNodesMeasured();
    initialFitView.markNodesMeasured();
    setReady(false);
    flush();
    setReady(true);
    flush();
    expect(fits()).toBe(1);
    dispose();
  });

  it("never fits when armed without fitView", () => {
    const { initialFitView, setReady, fits, dispose } = setup();
    initialFitView.arm(false);
    initialFitView.markNodesMeasured();
    setReady(true);
    flush();
    expect(fits()).toBe(0);
    dispose();
  });

  it("a re-arm waits for its own measuring pass (a new flow on a provider's state)", () => {
    // Under SolidFlowProvider the state outlives each <SolidFlow>: the next
    // one arms again and mounts a new pan-zoom. The previous flow's measured
    // nodes must not fire its fit: none of its own nodes has a size yet.
    const { initialFitView, setReady, fits, dispose } = setup();
    initialFitView.arm(true);
    initialFitView.markNodesMeasured();
    setReady(true);
    flush();
    expect(fits()).toBe(1);

    setReady(false);
    flush();
    initialFitView.arm(true);
    setReady(true);
    flush();
    expect(fits()).toBe(1);

    initialFitView.markNodesMeasured();
    expect(fits()).toBe(2);
    dispose();
  });
});
