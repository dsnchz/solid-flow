import type { OnResize, OnResizeEnd, OnResizeStart, ShouldResize } from "~/index";

export type ResizerData = {
  readonly label?: string;
  readonly visible?: boolean;
  readonly keepAspectRatio?: boolean;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly shouldResize?: ShouldResize;
  readonly onResizeStart?: OnResizeStart;
  readonly onResize?: OnResize;
  readonly onResizeEnd?: OnResizeEnd;
};
