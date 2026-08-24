import { createEventListenerMap } from "@solid-primitives/event-listener";
import { isServer } from "@solidjs/web";
import { isInputDOMNode, isMacOs } from "@xyflow/system";
import { flush } from "solid-js";

import { useInternalSolidFlow } from "@/contexts";
import { useSolidFlow } from "@/hooks/useSolidFlow";
import type { KeyDefinition, KeyDefinitionObject } from "@/types";

export type KeyHandlerProps = {
  readonly selectionKey?: KeyDefinition | KeyDefinition[] | null;
  readonly multiSelectionKey?: KeyDefinition | KeyDefinition[] | null;
  readonly deleteKey?: KeyDefinition | KeyDefinition[] | null;
  readonly panActivationKey?: KeyDefinition | KeyDefinition[] | null;
  readonly zoomActivationKey?: KeyDefinition | KeyDefinition[] | null;
};

function isKeyObject(key?: KeyDefinition | null): key is KeyDefinitionObject {
  return key !== null && typeof key === "object";
}

function getModifier(key?: KeyDefinition | null) {
  return isKeyObject(key) ? key.modifier || [] : [];
}

function getKeyString(key?: KeyDefinition | null): string {
  if (key === null || key === undefined) {
    return "";
  }
  return isKeyObject(key) ? key.key : key;
}

function matchesKey(event: KeyboardEvent, keyDef?: KeyDefinition | null): boolean {
  if (!keyDef) return false;

  const keyString = getKeyString(keyDef);
  if (!keyString) return false;

  const modifiers = getModifier(keyDef);

  if (Array.isArray(modifiers)) {
    const modifierMatch = modifiers
      .flatMap((mod) => mod)
      .every((mod) => {
        switch (mod.toLowerCase()) {
          case "meta":
            return event.metaKey;
          case "ctrl":
            return event.ctrlKey;
          case "alt":
            return event.altKey;
          case "shift":
            return event.shiftKey;
          default:
            return false;
        }
      });

    return event.key === keyString && modifierMatch;
  }

  return event.key === keyString;
}

function matchesKeyArray(
  event: KeyboardEvent,
  keyDefs: KeyDefinition | KeyDefinition[] | null | undefined,
): boolean {
  if (!keyDefs) return false;

  const keys = Array.isArray(keyDefs) ? keyDefs : [keyDefs];
  return keys.some((keyDef) => matchesKey(event, keyDef));
}

/** The modifier state every keyboard, pointer, and wheel event carries. */
type ModifierFlags = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

const MODIFIER_FLAG: Record<string, keyof ModifierFlags> = {
  alt: "altKey",
  control: "ctrlKey",
  ctrl: "ctrlKey",
  meta: "metaKey",
  shift: "shiftKey",
};

/**
 * Whether an event's modifier flags PROVE this key definition cannot be held
 * right now: the key itself is a modifier whose flag is off, or one of its
 * required modifiers is off. Definitions built on non-modifier keys are never
 * contradicted (their state isn't derivable from flags).
 */
function isContradicted(flags: ModifierFlags, keyDef: KeyDefinition): boolean {
  const keyFlag = MODIFIER_FLAG[getKeyString(keyDef).toLowerCase()];
  if (keyFlag && !flags[keyFlag]) return true;

  const modifiers = getModifier(keyDef);
  const mods = Array.isArray(modifiers) ? modifiers.flatMap((mod) => mod) : [modifiers];
  return mods.some((mod) => {
    const modFlag = MODIFIER_FLAG[mod.toLowerCase()];
    return !!modFlag && !flags[modFlag];
  });
}

/** True only when EVERY definition for this key state is contradicted. */
function allContradicted(
  flags: ModifierFlags,
  keyDefs: KeyDefinition | KeyDefinition[] | null | undefined,
): boolean {
  if (!keyDefs) return false;

  const keys = Array.isArray(keyDefs) ? keyDefs : [keyDefs];
  return keys.length > 0 && keys.every((keyDef) => isContradicted(flags, keyDef));
}

export const KeyHandler = (props: KeyHandlerProps) => {
  const { store, actions } = useInternalSolidFlow();
  const { deleteElements } = useSolidFlow();

  // Read-time defaults: `merge` in 2.0 treats an explicitly passed `undefined`
  // as an override, so parents forwarding optional props would clobber these.
  const _props = {
    get selectionKey() {
      return props.selectionKey ?? "Shift";
    },
    get multiSelectionKey() {
      return props.multiSelectionKey ?? (isMacOs() ? "Meta" : "Control");
    },
    get deleteKey() {
      return props.deleteKey ?? "Backspace";
    },
    get panActivationKey() {
      return props.panActivationKey ?? " ";
    },
    get zoomActivationKey() {
      return props.zoomActivationKey ?? (isMacOs() ? "Meta" : "Control");
    },
  };

  const resetKeysAndSelection = () => {
    {
      actions.setSelectionRect(undefined);
      actions.setSelectionKeyPressed(false);
      actions.setMultiselectionKeyPressed(false);
      actions.setDeleteKeyPressed(false);
      actions.setPanActivationKeyPressed(false);
      actions.setZoomActivationKeyPressed(false);
    }
  };

  /**
   * Self-heal stuck modifier state (upstream xyflow#5679): OS-level overlays
   * (the macOS screenshot HUD, some window switchers) swallow the keyup
   * WITHOUT blurring the window, so the blur reset never fires and stored key
   * state says "held" forever. Every later input event carries the true
   * modifier flags — clear any pressed state whose definitions those flags
   * contradict, before whatever reads that state this task.
   */
  const reconcileModifiers = (event: ModifierFlags) => {
    let changed = false;
    if (store.selectionKeyPressed && allContradicted(event, _props.selectionKey)) {
      actions.setSelectionKeyPressed(false);
      changed = true;
    }
    if (store.multiselectionKeyPressed && allContradicted(event, _props.multiSelectionKey)) {
      actions.setMultiselectionKeyPressed(false);
      changed = true;
    }
    if (store.panActivationKeyPressed && allContradicted(event, _props.panActivationKey)) {
      actions.setPanActivationKeyPressed(false);
      changed = true;
    }
    if (store.zoomActivationKeyPressed && allContradicted(event, _props.zoomActivationKey)) {
      actions.setZoomActivationKeyPressed(false);
      changed = true;
    }
    // Key state gates pointer handlers in the same task — commit now
    if (changed) flush();
  };

  /**
   * Finalize in-flight pointer gestures when the window loses focus
   * (upstream xyflow#5852): Alt+Tab while holding the button means the
   * window-level mouseup/pointerup never arrives, so d3-drag (node drags),
   * d3-zoom (pans), and XYHandle (connections) stay armed and resume chasing
   * the cursor on refocus. Their gesture listeners only exist while a gesture
   * is in flight, so a synthetic release on the window is a no-op when idle
   * and ends the gesture at its last position otherwise. d3's handlers read
   * `event.view`, so it must be set.
   */
  const cancelPointerGestures = () => {
    // d3's gesture teardown reads `event.view`, so it must be the window; the
    // fallback exists because jsdom's WebIDL check rejects test-runner window
    // proxies (real browsers always take the first path).
    const release = (Ctor: typeof MouseEvent, type: string) => {
      try {
        window.dispatchEvent(new Ctor(type, { view: window }));
      } catch {
        window.dispatchEvent(new Ctor(type));
      }
    };
    release(MouseEvent, "mouseup");
    if (typeof PointerEvent !== "undefined") {
      release(PointerEvent, "pointerup");
    }
  };

  const handleWindowBlur = () => {
    resetKeysAndSelection();
    cancelPointerGestures();
  };

  const handleDelete = async () => {
    const selectedNodes = store.nodes.filter((node) => node.selected);
    const selectedEdges = store.edges.filter((edge) => edge.selected);

    // deleteElements fires onDelete (and the granular delete callbacks)
    // itself, so the keyboard path and commands.deleteElements notify
    // identically.
    await deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    reconcileModifiers(event);
    {
      if (matchesKeyArray(event, _props.selectionKey)) {
        actions.setSelectionKeyPressed(true);
      }
      if (matchesKeyArray(event, _props.multiSelectionKey)) {
        actions.setMultiselectionKeyPressed(true);
      }
      if (matchesKeyArray(event, _props.deleteKey) && !isInputDOMNode(event)) {
        // Add safety check for modifier keys to prevent accidental deletions
        const isModifierKey = event.ctrlKey || event.metaKey || event.shiftKey;
        if (!isModifierKey) {
          actions.setDeleteKeyPressed(true);
          void handleDelete();
        }
      }
      if (matchesKeyArray(event, _props.panActivationKey)) {
        actions.setPanActivationKeyPressed(true);
      }
      if (matchesKeyArray(event, _props.zoomActivationKey)) {
        actions.setZoomActivationKeyPressed(true);
      }
    }
    // Key state gates pointer handlers in the same task — commit now
    flush();
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    reconcileModifiers(event);
    {
      if (matchesKeyArray(event, _props.selectionKey)) {
        actions.setSelectionKeyPressed(false);
      }
      if (matchesKeyArray(event, _props.multiSelectionKey)) {
        actions.setMultiselectionKeyPressed(false);
      }
      if (matchesKeyArray(event, _props.deleteKey)) {
        actions.setDeleteKeyPressed(false);
      }
      if (matchesKeyArray(event, _props.panActivationKey)) {
        actions.setPanActivationKeyPressed(false);
      }
      if (matchesKeyArray(event, _props.zoomActivationKey)) {
        actions.setZoomActivationKeyPressed(false);
      }
    }
    // Key state gates pointer handlers in the same task — commit now
    flush();
  };

  if (!isServer) {
    createEventListenerMap(window, {
      keydown: handleKeyDown,
      keyup: handleKeyUp,
      blur: handleWindowBlur,
      contextmenu: resetKeysAndSelection,
    });

    // Capture-phase so stuck state heals BEFORE the pane/zoom handlers (and
    // d3's own element-level listeners) read it in the same event.
    createEventListenerMap(
      window,
      {
        pointerdown: reconcileModifiers,
        wheel: reconcileModifiers,
      },
      { capture: true, passive: true },
    );
  }

  return null;
};
