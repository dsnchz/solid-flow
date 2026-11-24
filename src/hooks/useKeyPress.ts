import { createEventListenerMap } from "@solid-primitives/event-listener";
import { isServer } from "@solidjs/web";
import { type Accessor, createEffect, createSignal, flush, useContext } from "solid-js";

import { clientOnlySetup } from "@/components/internal/dom";
import { SolidFlowContext } from "@/contexts/flow";
import { allContradicted, matchesKeyArray, type ModifierFlags } from "@/core/keys";
import type { KeyDefinition } from "@/types";

/**
 * Reactive "is this key (combo) held right now?" — the Solid Flow
 * counterpart of React Flow's `useKeyPress`, usable anywhere (no flow
 * context required).
 *
 * The definition is an Accessor per house convention — `useKeyPress(() =>
 * "a")`, `useKeyPress(() => ["a", "d"])`, or `useKeyPress(() => ({ key:
 * "s", modifier: ["meta"] }))`; swapping the definition resets the state.
 *
 * Hardened beyond upstream:
 * - Combos re-activate when the base key is re-pressed while the modifier
 *   stays held (upstream's oldest open key bug, xyflow#2248).
 * - Stuck modifiers self-heal from the flags later keyboard/pointer/wheel
 *   events carry (OS overlays swallow keyups without blurring — the macOS
 *   screenshot HUD; xyflow#5679), and window blur resets.
 * - Inside a flow rendered in another window (a popout), it listens to
 *   that window.
 */
export function useKeyPress(
  keys: Accessor<KeyDefinition | KeyDefinition[] | null>,
): Accessor<boolean> {
  const [pressed, setPressed] = createSignal(false);
  // Inside a flow, the window the flow is rendered in (a same-origin popout
  // gets its own keys, xyflow#6124); elsewhere, this window.
  const flow = useContext(SolidFlowContext);
  const target = () => flow?.store.domNode?.ownerDocument.defaultView ?? window;

  // Swapping definitions mid-flight must not leave a stale "held".
  createEffect(
    () => keys(),
    () => {
      setPressed(false);
    },
    { defer: true, name: "useKeyPress" },
  );

  // Client-only listeners: outside the hydration id sequence (see clientOnlySetup).
  if (!isServer) {
    clientOnlySetup(() => {
      const reconcile = (event: ModifierFlags) => {
        if (pressed() && allContradicted(event, keys())) {
          setPressed(false);
          flush();
        }
      };

      createEventListenerMap(target, {
        keydown: (event: KeyboardEvent) => {
          reconcile(event);
          if (matchesKeyArray(event, keys())) {
            setPressed(true);
            flush();
          }
        },
        keyup: (event: KeyboardEvent) => {
          reconcile(event);
          // A keyup belonging to the tracked definition releases it — including
          // a combo's base key while its modifier stays held (#2248: the next
          // matching keydown simply re-activates).
          if (matchesKeyArray(event, keys())) {
            setPressed(false);
            flush();
          }
        },
        blur: () => {
          setPressed(false);
          flush();
        },
      });

      createEventListenerMap(
        target,
        {
          pointerdown: reconcile,
          wheel: reconcile,
        },
        { capture: true, passive: true },
      );
    });
  }

  return pressed;
}
