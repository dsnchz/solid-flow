// @vitest-environment node
import { describe, expect, it } from "vitest";

import { minimapFrame, minimapMaskPath } from "../minimapLayout";

// The minimap's view, from the rect it must show (the graph's bounds joined
// with the visible viewport) and its own size: one scale fits the rect into
// the minimap's aspect, centered, padded by offsetScale minimap pixels.

describe("minimapFrame", () => {
  it("fits a rect of the minimap's aspect, padded on every side", () => {
    const frame = minimapFrame({
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      width: 200,
      height: 150,
      offsetScale: 5,
    });
    expect(frame).toEqual({ viewScale: 2, offset: 10, x: -10, y: -10, width: 420, height: 320 });
  });

  it("scales by the tighter side and centers the other", () => {
    const frame = minimapFrame({
      bounds: { x: 0, y: 0, width: 800, height: 100 },
      width: 200,
      height: 150,
      offsetScale: 0,
    });
    // width-bound: 800 / 200 = 4; the 600-unit-tall view centers the 100
    expect(frame).toEqual({ viewScale: 4, offset: 0, x: 0, y: -250, width: 800, height: 600 });
  });
});

describe("minimapMaskPath", () => {
  it("masks everything around the visible viewport", () => {
    const frame = minimapFrame({
      bounds: { x: 0, y: 0, width: 400, height: 300 },
      width: 200,
      height: 150,
      offsetScale: 5,
    });
    // outer rect: the frame grown by one more offset; inner: the viewport
    expect(minimapMaskPath(frame, { x: 50, y: 60, width: 100, height: 80 })).toBe(
      "M-20,-20h440v340h-440z M50,60h100v80h-100z",
    );
  });
});
