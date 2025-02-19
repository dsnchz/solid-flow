import type { EdgeProps } from "@/shared/types";

export type BaseEdgeProps = Pick<
  EdgeProps,
  "interactionWidth" | "label" | "labelStyle" | "style"
> & {
  readonly id?: string;
  /** SVG path of the edge */
  readonly path: string;
  /** The x coordinate of the label */
  readonly labelX?: number;
  /** The y coordinate of the label */
  readonly labelY?: number;
  /** Marker at start of edge
   * @example 'url(#arrow)'
   */
  readonly markerStart?: string;
  /** Marker at end of edge
   * @example 'url(#arrow)'
   */
  readonly markerEnd?: string;
  readonly class?: string;
};
