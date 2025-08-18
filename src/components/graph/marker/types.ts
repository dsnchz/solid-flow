import type { MarkerProps as SystemMarkerProps } from "@xyflow/system";

export type MarkerProps = SystemMarkerProps & {
  readonly markerUnits?: "strokeWidth" | "userSpaceOnUse";
  readonly color?: string;
  readonly strokeWidth?: number;
};
