import "@testing-library/jest-dom/vitest";

/**
 * jsdom does not implement ResizeObserver. This stub delivers a single entry per
 * observed element (asynchronously, like the real API) so the node measurement
 * pipeline (NodeRenderer -> requestUpdateNodeInternals) runs end-to-end.
 */
class ResizeObserverStub implements ResizeObserver {
  #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    queueMicrotask(() => {
      const rect = target.getBoundingClientRect();
      this.#callback([{ target, contentRect: rect } as unknown as ResizeObserverEntry], this);
    });
  }

  unobserve(): void {
    /* noop */
  }

  disconnect(): void {
    /* noop */
  }
}

// The DOM-free core lane (// @vitest-environment node docblocks) shares this
// setup file; everything below only applies where a DOM exists.
if (typeof HTMLElement !== "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  /**
   * jsdom has no layout engine: offsetWidth/offsetHeight and getBoundingClientRect
   * always report 0. Derive them from inline `width`/`height` styles so nodes that
   * declare explicit dimensions get "measured" with those values.
   */
  const stylePx = (el: HTMLElement, prop: "width" | "height"): number => {
    const value = el.style?.[prop];
    const parsed = value ? Number.parseFloat(value) : Number.NaN;
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return stylePx(this, "width");
      },
    },
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return stylePx(this, "height");
      },
    },
    // The flow container's ResizeObserver reads client dimensions
    // (SolidFlow's width/height props land as inline styles on it).
    clientWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return stylePx(this, "width");
      },
    },
    clientHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return stylePx(this, "height");
      },
    },
  });

  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const rect = originalGetBoundingClientRect.call(this);
    if (rect.width === 0 && rect.height === 0) {
      const width = stylePx(this, "width");
      const height = stylePx(this, "height");
      if (width || height) {
        return {
          x: rect.x,
          y: rect.y,
          top: rect.y,
          left: rect.x,
          width,
          height,
          right: rect.x + width,
          bottom: rect.y + height,
          toJSON: () => undefined,
        } as DOMRect;
      }
    }
    return rect;
  };

  /** jsdom does not implement matchMedia (needed by createMediaQuery for color mode). */
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
  }

  /** jsdom does not implement PointerEvent; extend MouseEvent with the pointer fields. */
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      readonly isPrimary: boolean;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
  }

  /**
   * jsdom does not implement DOMMatrixReadOnly, which @xyflow/system uses to read
   * the viewport zoom out of a CSS transform. Only `m22` is consumed.
   */
  if (typeof window.DOMMatrixReadOnly === "undefined") {
    class DOMMatrixReadOnlyPolyfill {
      readonly m22: number;

      constructor(transform?: string) {
        const match = transform?.match(/matrix\(([^)]+)\)/);
        const parts = match?.[1]?.split(",").map((v) => Number.parseFloat(v.trim()));
        this.m22 = parts?.[3] ?? 1;
      }
    }
    window.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
  }
}
