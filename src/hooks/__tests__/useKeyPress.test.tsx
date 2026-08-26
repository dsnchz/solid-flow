import { render } from "@solidjs/testing-library";
import { createSignal, flush } from "solid-js";
import { describe, expect, it } from "vitest";

import { useKeyPress } from "@/hooks/useKeyPress";
import type { KeyDefinition } from "@/types";

const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);
const keyUp = (init: KeyboardEventInit) => new KeyboardEvent("keyup", init);

const harness = (keys: () => KeyDefinition | KeyDefinition[] | null) => {
  let pressed!: () => boolean;
  const Probe = () => {
    pressed = useKeyPress(keys);
    return null;
  };
  render(() => <Probe />);
  return () => pressed();
};

describe("useKeyPress", () => {
  it("tracks a plain key down and up", () => {
    const pressed = harness(() => "a");
    expect(pressed()).toBe(false);
    window.dispatchEvent(key({ key: "a" }));
    expect(pressed()).toBe(true);
    window.dispatchEvent(keyUp({ key: "a" }));
    expect(pressed()).toBe(false);
  });

  it("matches any definition in an array", () => {
    const pressed = harness(() => ["a", "d"]);
    window.dispatchEvent(key({ key: "d" }));
    expect(pressed()).toBe(true);
    window.dispatchEvent(keyUp({ key: "d" }));
    expect(pressed()).toBe(false);
  });

  it("supports modifier combos, including re-press before full release (xyflow#2248)", () => {
    const pressed = harness(() => ({ key: "s", modifier: ["meta"] }));
    window.dispatchEvent(key({ key: "s", metaKey: true }));
    expect(pressed()).toBe(true);
    // Release only the base key, keep Meta held: combo is no longer active…
    window.dispatchEvent(keyUp({ key: "s", metaKey: true }));
    expect(pressed()).toBe(false);
    // …and RE-pressing the base key without releasing Meta activates again —
    // upstream's oldest open key bug.
    window.dispatchEvent(key({ key: "s", metaKey: true }));
    expect(pressed()).toBe(true);
  });

  it("resets on window blur", () => {
    const pressed = harness(() => "a");
    window.dispatchEvent(key({ key: "a" }));
    expect(pressed()).toBe(true);
    window.dispatchEvent(new Event("blur"));
    expect(pressed()).toBe(false);
  });

  it("self-heals stuck modifiers from later events (xyflow#5679 hardening)", () => {
    const pressed = harness(() => "Shift");
    window.dispatchEvent(key({ key: "Shift", shiftKey: true }));
    expect(pressed()).toBe(true);
    // The keyup was swallowed by an OS overlay; the next pointer event
    // carries the truth.
    window.dispatchEvent(new MouseEvent("pointerdown", { shiftKey: false }));
    expect(pressed()).toBe(false);
  });

  it("is reactive to the key accessor", () => {
    const [keys, setKeys] = createSignal<KeyDefinition>("a");
    const pressed = harness(keys);
    window.dispatchEvent(key({ key: "a" }));
    expect(pressed()).toBe(true);
    // Switching the tracked key resets state (settles on flush).
    setKeys("b");
    flush();
    expect(pressed()).toBe(false);
    window.dispatchEvent(key({ key: "b" }));
    expect(pressed()).toBe(true);
  });
});
