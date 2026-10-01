/**
 * Reactive prop defaulting with skip-undefined semantics: a prop counts as
 * "absent" when it reads `undefined`, so parents forwarding optional props
 * (e.g. `<Handle position={props.targetPosition} />`) do not clobber defaults.
 * This is deliberate policy on top of Solid 2.0's `merge`, where `undefined`
 * is a real value that overrides.
 */
export function propDefaults<T extends object, D extends Partial<T>>(
  props: T,
  defaults: D,
): T & Required<Pick<T, keyof D & keyof T>> {
  const out = {} as T & Required<Pick<T, keyof D & keyof T>>;
  const keys = new Set([...Object.keys(defaults), ...Object.keys(props)]);
  for (const key of keys) {
    Object.defineProperty(out, key, {
      // ONE read of the prop: a JSX `children` getter instantiates the
      // children on every read (a second read rendered a throwaway copy per
      // mount and spent a hydration key the server had used for the real one).
      get: () => {
        const value = (props as Record<string, unknown>)[key];
        return value !== undefined ? value : (defaults as Record<string, unknown>)[key];
      },
      enumerable: true,
      configurable: true,
    });
  }
  return out;
}
