import { type Accessor } from "solid-js";

type ShortcutModifier = "alt" | "ctrl" | "shift" | "meta";

type ShortcutTrigger = {
  readonly id?: string;
  readonly key: string;
  readonly enabled?: boolean;
  readonly modifier?: (ShortcutModifier | ShortcutModifier[])[];
  readonly callback?: (detail: ShortcutEventDetail) => void;
  readonly preventDefault?: boolean;
};

type ShortcutConfig = {
  readonly triggers: ShortcutTrigger[];
  readonly type?: "keydown" | "keyup";
  readonly enabled?: boolean;
};

type ShortcutEventDetail = {
  node: HTMLElement;
  trigger: ShortcutTrigger;
  originalEvent: KeyboardEvent;
};

// Register type with TypeScript
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      shortcut: ShortcutConfig[];
    }
  }
}

export default function shortcut(element: HTMLElement, params: Accessor<ShortcutConfig[]>) {
  const handleConfig = (config: ShortcutConfig) => {
    const { enabled = true, triggers, type = "keydown" } = config;

    const handler = (event: KeyboardEvent) => {
      const modifiedMap = {
        alt: event.altKey,
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };

      for (const trigger of triggers) {
        const mergedTrigger = {
          modifier: [],
          preventDefault: false,
          enabled: true,
          ...trigger,
        };

        const { modifier, key, callback, preventDefault, enabled: triggerEnabled } = mergedTrigger;

        if (triggerEnabled) {
          if (modifier.length) {
            const modifierDefs = (Array.isArray(modifier) ? modifier : [modifier]).map((def) =>
              typeof def === "string" ? [def] : def,
            );

            const modified = modifierDefs.some((def) =>
              def.every((modifier) => modifiedMap[modifier]),
            );

            if (!modified) continue;
          }

          if (event.key === key) {
            if (preventDefault) event.preventDefault();

            const detail: ShortcutEventDetail = {
              node: element,
              trigger: mergedTrigger,
              originalEvent: event,
            };

            element.dispatchEvent(new CustomEvent("shortcut", { detail }));

            callback?.(detail);
          }
        }
      }
    };

    if (enabled) {
      element.addEventListener(type, handler);
    }

    return () => {
      element.removeEventListener(type, handler);
    };
  };

  let cleanupFns: (() => void)[] = [];

  const update = () => {
    // Cleanup previous listeners
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];

    // Setup new listeners
    const configs = params();
    configs.forEach((config) => {
      cleanupFns.push(handleConfig(config));
    });
  };

  // Initial setup
  update();

  // Return update function
  return update;
}
