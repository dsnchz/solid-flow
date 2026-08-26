import type { KeyDefinition, KeyDefinitionObject } from "@/types";

/** The modifier state every keyboard, pointer, and wheel event carries. */
export type ModifierFlags = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">;

const MODIFIER_FLAG: Record<string, keyof ModifierFlags> = {
  alt: "altKey",
  control: "ctrlKey",
  ctrl: "ctrlKey",
  meta: "metaKey",
  shift: "shiftKey",
};

function isKeyObject(key?: KeyDefinition | null): key is KeyDefinitionObject {
  return key !== null && typeof key === "object";
}

export function getModifier(key?: KeyDefinition | null) {
  return isKeyObject(key) ? key.modifier || [] : [];
}

export function getKeyString(key?: KeyDefinition | null): string {
  if (key === null || key === undefined) return "";
  return isKeyObject(key) ? key.key : key;
}

export function matchesKey(event: KeyboardEvent, keyDef?: KeyDefinition | null): boolean {
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

export function matchesKeyArray(
  event: KeyboardEvent,
  keyDefs: KeyDefinition | KeyDefinition[] | null | undefined,
): boolean {
  if (!keyDefs) return false;

  const keys = Array.isArray(keyDefs) ? keyDefs : [keyDefs];
  return keys.some((keyDef) => matchesKey(event, keyDef));
}

/**
 * Whether an event's modifier flags PROVE this key definition cannot be held
 * right now: the key itself is a modifier whose flag is off, or one of its
 * required modifiers is off. Definitions built on non-modifier keys are never
 * contradicted (their state isn't derivable from flags). This is the
 * self-heal for OS overlays that swallow keyups without blurring the window
 * (upstream xyflow#5679).
 */
export function isContradicted(flags: ModifierFlags, keyDef: KeyDefinition): boolean {
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
export function allContradicted(
  flags: ModifierFlags,
  keyDefs: KeyDefinition | KeyDefinition[] | null | undefined,
): boolean {
  if (!keyDefs) return false;

  const keys = Array.isArray(keyDefs) ? keyDefs : [keyDefs];
  return keys.length > 0 && keys.every((keyDef) => isContradicted(flags, keyDef));
}
