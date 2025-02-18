import { createSignal } from "solid-js";

export const App = () => {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <div>Playground App</div>
      <div>Count: {count()}</div>
      <button
        onClick={() => {
          setCount((prev) => prev + 1);
        }}
      >
        Increment Count
      </button>
    </div>
  );
};
