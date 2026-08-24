import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";

import { SolidFlow } from "@/components/SolidFlow";
import { useInternalSolidFlow } from "@/contexts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

const renderFlow = () => {
  let internal!: ReturnType<typeof useInternalSolidFlow>;
  const Probe = () => {
    internal = useInternalSolidFlow();
    return null;
  };
  render(() => (
    <SolidFlow nodes={[]} edges={[]} width={800} height={600}>
      <Probe />
    </SolidFlow>
  ));
  return () => internal.store;
};

const pressShift = () =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", shiftKey: true }));

describe("KeyHandler focus-loss hardening", () => {
  it("heals stuck modifier state from a pointer event's flags (xyflow#5679)", async () => {
    const store = renderFlow();
    await tick();

    // Simulate the macOS-screenshot-HUD scenario: the keydown registered,
    // the keyup was swallowed by an OS overlay, no window blur ever fired.
    pressShift();
    expect(store().selectionKeyPressed).toBe(true);

    // The next real interaction carries the truth: Shift is not held.
    window.dispatchEvent(new MouseEvent("pointerdown", { shiftKey: false }));
    expect(store().selectionKeyPressed).toBe(false);
  });

  it("does not clear modifier state the event's flags confirm", async () => {
    const store = renderFlow();
    await tick();

    pressShift();
    window.dispatchEvent(new MouseEvent("pointerdown", { shiftKey: true }));
    expect(store().selectionKeyPressed).toBe(true);
  });

  it("heals from wheel and keyboard events too", async () => {
    const store = renderFlow();
    await tick();

    // Non-mac default multi-selection key is Control (jsdom UA is not mac).
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Control", ctrlKey: true }));
    expect(store().multiselectionKeyPressed).toBe(true);
    window.dispatchEvent(new WheelEvent("wheel", { ctrlKey: false }));
    expect(store().multiselectionKeyPressed).toBe(false);

    pressShift();
    expect(store().selectionKeyPressed).toBe(true);
    // A later keydown of an unrelated key without Shift held contradicts it.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", shiftKey: false }));
    expect(store().selectionKeyPressed).toBe(false);
  });

  it("leaves non-modifier key state alone (not derivable from flags)", async () => {
    const store = renderFlow();
    await tick();

    // Default pan-activation key is Space — flags can't disprove it.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(store().panActivationKeyPressed).toBe(true);
    window.dispatchEvent(new MouseEvent("pointerdown"));
    expect(store().panActivationKeyPressed).toBe(true);
  });

  it("finalizes in-flight pointer gestures on window blur (xyflow#5852)", async () => {
    renderFlow();
    await tick();

    // d3-drag/d3-zoom/XYHandle end gestures on a window-level release; assert
    // the blur handler synthesizes both flavors. (`event.view` is set on the
    // real-browser path — jsdom rejects window proxies as WebIDL Windows, so
    // that half is covered by the E2E focus-loss spec.)
    const released: string[] = [];
    const onMouseUp = (event: MouseEvent) => {
      released.push(event.type);
    };
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("pointerup", onMouseUp);
    try {
      window.dispatchEvent(new Event("blur"));
      expect(released).toContain("mouseup");
      if (typeof PointerEvent !== "undefined") {
        expect(released).toContain("pointerup");
      }
    } finally {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("pointerup", onMouseUp);
    }
  });

  it("still resets key state on window blur", async () => {
    const store = renderFlow();
    await tick();

    pressShift();
    expect(store().selectionKeyPressed).toBe(true);
    window.dispatchEvent(new Event("blur"));
    // The blur path has no same-task readers, so it relies on the normal
    // deferred flush rather than flushing synchronously.
    await tick();
    expect(store().selectionKeyPressed).toBe(false);
  });
});
