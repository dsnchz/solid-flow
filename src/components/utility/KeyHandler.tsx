import { isInputDOMNode, isMacOs } from "@xyflow/system";
import { type Component, mergeProps, onCleanup, onMount } from "solid-js";

import { useFlowStore } from "@/components/contexts";
import type { KeyDefinition, KeyDefinitionObject } from "@/shared/types";

export type KeyHandlerProps = {
  readonly selectionKey: KeyDefinition;
  readonly multiSelectionKey: KeyDefinition;
  readonly deleteKey: KeyDefinition;
  readonly panActivationKey: KeyDefinition;
  readonly zoomActivationKey: KeyDefinition;
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

const KeyHandler: Component<Partial<KeyHandlerProps>> = (props) => {
  const { setStore } = useFlowStore();

  const _props = mergeProps(
    {
      selectionKey: "Shift",
      multiSelectionKey: isMacOs() ? "Meta" : "Control",
      deleteKey: "Backspace",
      panActivationKey: " ",
      zoomActivationKey: isMacOs() ? "Meta" : "Control",
    },
    props,
  );

  const resetKeys = () => {
    setStore({
      selectionKeyPressed: false,
      multiselectionKeyPressed: false,
      deleteKeyPressed: false,
      panActivationKeyPressed: false,
      zoomActivationKeyPressed: false,
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (matchesKey(event, _props.selectionKey)) {
      setStore({ selectionKeyPressed: true });
    }
    if (matchesKey(event, _props.multiSelectionKey)) {
      setStore({ multiselectionKeyPressed: true });
    }
    if (matchesKey(event, _props.deleteKey) && !isInputDOMNode(event)) {
      setStore({ deleteKeyPressed: true });
    }
    if (matchesKey(event, _props.panActivationKey)) {
      setStore({ panActivationKeyPressed: true });
    }
    if (matchesKey(event, _props.zoomActivationKey)) {
      setStore({ zoomActivationKeyPressed: true });
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (matchesKey(event, _props.selectionKey)) {
      setStore({ selectionKeyPressed: false });
    }
    if (matchesKey(event, _props.multiSelectionKey)) {
      setStore({ multiselectionKeyPressed: false });
    }
    if (matchesKey(event, _props.deleteKey)) {
      setStore({ deleteKeyPressed: false });
    }
    if (matchesKey(event, _props.panActivationKey)) {
      setStore({ panActivationKeyPressed: false });
    }
    if (matchesKey(event, _props.zoomActivationKey)) {
      setStore({ zoomActivationKeyPressed: false });
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetKeys);
    window.addEventListener("contextmenu", resetKeys);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetKeys);
      window.removeEventListener("contextmenu", resetKeys);
    });
  });

  return null;
};

export default KeyHandler;
