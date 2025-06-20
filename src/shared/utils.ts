export const isNumber = (v: unknown) => typeof v === "number";

export const eqSet = <T>(a: Set<T>, b: Set<T>) =>
  a.size === b.size && [...a].every((x) => b.has(x));
