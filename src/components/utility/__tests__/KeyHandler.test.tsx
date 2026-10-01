import { render } from "@solidjs/testing-library";
import { flush } from "solid-js";
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

describe("KeyHandler key props", () => {
  const renderKeyed = (keys: Record<string, null>) => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow
        nodes={[{ id: "a", position: { x: 0, y: 0 }, data: {}, selected: true }]}
        edges={[]}
        width={800}
        height={600}
        {...keys}
      >
        <Probe />
      </SolidFlow>
    ));
    return () => internal;
  };

  const press = (key: string, init: KeyboardEventInit = {}) =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));

  it("a key set to null is disabled, not replaced by its default", async () => {
    const flow = renderKeyed({
      selectionKey: null,
      multiSelectionKey: null,
      deleteKey: null,
      panActivationKey: null,
      zoomActivationKey: null,
    });
    await tick();

    press("Shift", { shiftKey: true });
    press("Control", { ctrlKey: true });
    press(" ");
    press("Backspace");
    await tick();

    const { store } = flow();
    expect(store.selectionKeyPressed).toBe(false);
    expect(store.multiselectionKeyPressed).toBe(false);
    expect(store.zoomActivationKeyPressed).toBe(false);
    expect(store.panActivationKeyPressed).toBe(false);
    expect(store.deleteKeyPressed).toBe(false);
    expect(store.nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("an omitted delete key defaults to Backspace", async () => {
    const flow = renderKeyed({});
    await tick();

    press("Backspace");
    await tick();

    expect(flow().store.nodes).toHaveLength(0);
  });
});

describe("KeyHandler key state", () => {
  const renderStore = () => {
    let internal!: ReturnType<typeof useInternalSolidFlow>;
    const Probe = () => {
      internal = useInternalSolidFlow();
      return null;
    };
    render(() => (
      <SolidFlow
        nodes={[{ id: "a", position: { x: 0, y: 0 }, data: {}, selected: true }]}
        edges={[]}
        width={800}
        height={600}
        multiSelectionKey="Control"
        zoomActivationKey="Alt"
      >
        <Probe />
      </SolidFlow>
    ));
    return () => internal.store;
  };
  const key = (type: "keydown" | "keyup", init: KeyboardEventInit) =>
    window.dispatchEvent(new KeyboardEvent(type, init));

  it.each([
    ["selectionKeyPressed", { key: "Shift", shiftKey: true }, { key: "Shift" }],
    ["multiselectionKeyPressed", { key: "Control", ctrlKey: true }, { key: "Control" }],
    ["panActivationKeyPressed", { key: " " }, { key: " " }],
    ["zoomActivationKeyPressed", { key: "Alt", altKey: true }, { key: "Alt" }],
  ] as const)("%s follows its key down and up", async (flag, down, up) => {
    const store = renderStore();
    await tick();
    key("keydown", down);
    expect(store()[flag]).toBe(true);
    key("keyup", up);
    expect(store()[flag]).toBe(false);
  });

  it("the delete key deletes the selection, unless a modifier is held", async () => {
    const store = renderStore();
    await tick();
    key("keydown", { key: "Backspace", shiftKey: true });
    await tick();
    expect(store().deleteKeyPressed).toBe(false);
    expect(store().nodes).toHaveLength(1);

    key("keydown", { key: "Backspace" });
    expect(store().deleteKeyPressed).toBe(true);
    await tick();
    expect(store().nodes).toHaveLength(0);
    key("keyup", { key: "Backspace" });
    expect(store().deleteKeyPressed).toBe(false);
  });

  it("a context menu resets every key", async () => {
    const store = renderStore();
    await tick();
    key("keydown", { key: "Shift", shiftKey: true });
    key("keydown", { key: " " });
    window.dispatchEvent(new MouseEvent("contextmenu"));
    // like the blur reset, it has no same-task readers and does not flush
    flush();
    expect(store().selectionKeyPressed).toBe(false);
    expect(store().panActivationKeyPressed).toBe(false);
  });
});
