import {
  ConnectionLineType as SystemConnectionLineType,
  ConnectionMode as SystemConnectionMode,
  MarkerType as SystemMarkerType,
  PanOnScrollMode as SystemPanOnScrollMode,
  Position as SystemPosition,
  ResizeControlVariant as SystemResizeControlVariant,
  SelectionMode as SystemSelectionMode,
} from "@xyflow/system";
import { describe, expect, it } from "vitest";

import {
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
  PanOnScrollMode,
  Position,
  ResizeControlVariant,
  SelectionMode,
} from "@/index";

/**
 * The public surface pairs each @xyflow/system enum VALUE with a
 * string-union TYPE under the same name (types/general.ts). The value must
 * stay the upstream enum object — its members are the only thing assignable
 * into system-owned fields like `NodeBase.sourcePosition` — while the union
 * type makes plain literals first-class (`const p: Position = "right"`,
 * rejected under a nominal-enum type export).
 */
describe("enum mirrors (enum values + union types)", () => {
  it("string literals are assignable to the public types", () => {
    // Compile-level contract, enforced by the tsc gate: each of these lines
    // is a type error while the public types are the nominal upstream enums.
    const position: Position = "right";
    const connectionLineType: ConnectionLineType = "smoothstep";
    const connectionMode: ConnectionMode = "loose";
    const markerType: MarkerType = "arrowclosed";
    const panOnScrollMode: PanOnScrollMode = "free";
    const resizeControlVariant: ResizeControlVariant = "line";
    const selectionMode: SelectionMode = "partial";
    expect([
      position,
      connectionLineType,
      connectionMode,
      markerType,
      panOnScrollMode,
      resizeControlVariant,
      selectionMode,
    ]).toEqual(["right", "smoothstep", "loose", "arrowclosed", "free", "line", "partial"]);
  });

  it("member objects are the upstream enum objects (system-field compatibility)", () => {
    expect(Position).toBe(SystemPosition);
    expect(ConnectionLineType).toBe(SystemConnectionLineType);
    expect(ConnectionMode).toBe(SystemConnectionMode);
    expect(MarkerType).toBe(SystemMarkerType);
    expect(PanOnScrollMode).toBe(SystemPanOnScrollMode);
    expect(ResizeControlVariant).toBe(SystemResizeControlVariant);
    expect(SelectionMode).toBe(SystemSelectionMode);
  });
});
