import type { ColorModeClass } from "@xyflow/system";

import { useInternalSolidFlow } from "~/components/contexts";

/**
 * Hook for receiving the current color mode class ('dark' or 'light').
 *
 * When the flow's `colorMode` prop is set to `"system"`, this resolves to the
 * user's current system preference.
 *
 * @public
 * @returns an accessor for the current color mode class
 */
export function useColorMode(): () => ColorModeClass {
  const { flow } = useInternalSolidFlow();
  return () => flow.colorMode;
}
