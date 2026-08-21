import type { InternalNodeUpdate } from "@xyflow/system";
import type { StoreSetter } from "solid-js";
import type { Store } from "solid-js";

import type { Edge, Node } from "~/types";

import type { createSolidFlow } from "./createSolidFlow";

export type RequireProps<TSource extends object, TRequiredProps extends keyof TSource> = Omit<
  TSource,
  TRequiredProps
> &
  Required<Pick<TSource, TRequiredProps>>;

export type SolidStore<T> = [get: Store<T>, set: StoreSetter<T>];

export type SolidFlowStore<TNode extends Node, TEdge extends Edge> = ReturnType<
  typeof createSolidFlow<TNode, TEdge>
>;

export type InternalUpdateEntry = [string, InternalNodeUpdate];
