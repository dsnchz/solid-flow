import type { ColorMode } from "@xyflow/system";
import { createSignal } from "solid-js";

export const [colorModeClass, setColorModeClass] = createSignal<ColorMode>("light");
