import { isInputDOMNode, isMacOs } from "@xyflow/system";
import { batch, mergeProps, onCleanup, onMount } from "solid-js";

import { useInternalSolidFlow } from "@/components/contexts";
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

const KeyHandler = (props: KeyHandlerProps) => {
  const { store, actions } = useInternalSolidFlow();
  const { deleteElements } = useSolidFlow();

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

  const resetKeysAndSelection = () => {
    batch(() => {
      actions.setSelectionRect(undefined);
      actions.setSelectionKeyPressed(false);
      actions.setMultiselectionKeyPressed(false);
      actions.setDeleteKeyPressed(false);
      actions.setPanActivationKeyPressed(false);
      actions.setZoomActivationKeyPressed(false);
    });
  };

  const handleDelete = async () => {
    const selectedNodes = store.nodes.filter((node) => node.selected);
    const selectedEdges = store.edges.filter((edge) => edge.selected);

    const { deletedNodes, deletedEdges } = await deleteElements({
      nodes: selectedNodes,
      edges: selectedEdges,
    });

    if (deletedNodes.length > 0 || deletedEdges.length > 0) {
      store.onDelete?.({
        nodes: deletedNodes,
        edges: deletedEdges,
      });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    batch(() => {
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
    });
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    batch(() => {
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
    });
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", resetKeysAndSelection);
    window.addEventListener("contextmenu", resetKeysAndSelection);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", resetKeysAndSelection);
      window.removeEventListener("contextmenu", resetKeysAndSelection);
    });
  });

  return null;
};

export default KeyHandler;
