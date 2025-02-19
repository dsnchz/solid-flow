import type { ColorModeClass } from "@xyflow/system";
import { createSignal } from "solid-js";

export const [colorModeClass, setColorModeClass] = createSignal<ColorModeClass>("light");
