export type MouseOrTouchEvent = MouseEvent | TouchEvent;
export type MouseOrTouchEventHandler = (event: MouseOrTouchEvent) => void;
export type GraphTargetHandler<T> = (target: T, event: MouseOrTouchEvent) => void;
export type GraphMultiTargetHandler<T> = (targets: T[], event: MouseOrTouchEvent) => void;
export type GraphTargetContextHandler<T> = (
  target: T | null,
  items: T[],
  event: MouseOrTouchEvent,
) => void;
