import type { JSX } from "@solidjs/web";
import { createMemo } from "solid-js";

import type { StraightEdgeProps } from "@/types";

import { BaseEdge } from "./BaseEdge";

/** What every built-in edge passes through to BaseEdge. */
type PathEdgeProps = Pick<
  StraightEdgeProps,
  "id" | "label" | "labelStyle" | "markerStart" | "markerEnd" | "interactionWidth" | "style"
>;

/** @xyflow/system's path functions: the path, then the label position. */
type PathResult = readonly [path: string, labelX: number, labelY: number, ...rest: number[]];

/**
 * A built-in edge component from its path function. Each shape comes in two
 * variants: the public one (used inside custom edges) puts its `id` on the
 * path element; the renderer's own (`withId: false`) leaves the path without
 * a DOM id.
 */
export const createPathEdge =
  <P extends PathEdgeProps>(pathOf: (props: P) => PathResult, withId: boolean) =>
  (props: P): JSX.Element => {
    // One path computation per input change: three getters read it (bench round 35).
    const pathData = createMemo(
      () => {
        const [path, labelX, labelY] = pathOf(props);
        return { path, labelX, labelY };
      },
      { name: "pathEdge.pathData" },
    );

    return (
      <BaseEdge
        id={withId ? props.id : undefined}
        path={pathData().path}
        labelX={pathData().labelX}
        labelY={pathData().labelY}
        label={props.label}
        labelStyle={props.labelStyle}
        markerStart={props.markerStart}
        markerEnd={props.markerEnd}
        interactionWidth={props.interactionWidth}
        style={props.style}
      />
    );
  };
