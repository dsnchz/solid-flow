import type { JSX } from "@solidjs/web";
import { type Accessor, createSignal, merge, type ParentProps } from "solid-js";

type Props = ParentProps<{ label?: string; style?: JSX.CSSProperties }>;

export const Widget = (props: Props): JSX.Element => {
  const merged = merge({ label: "default" }, props);
  const [active, setActive] = createSignal(false);
  const read: Accessor<boolean> = active;
  return (
    <div class={{ active: read() }} tabindex={-1} onClick={() => setActive(true)}>
      {merged.label}
      {props.children}
    </div>
  );
};
