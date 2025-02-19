import { type Component, onCleanup, onMount } from "solid-js";

type CallOnMountProps = {
  readonly onMount?: () => void;
  readonly onCleanup?: () => void;
};

const CallOnMount: Component<CallOnMountProps> = (props) => {
  onMount(() => {
    props.onMount?.();
  });

  onCleanup(() => {
    props.onCleanup?.();
  });

  return null;
};

export default CallOnMount;
