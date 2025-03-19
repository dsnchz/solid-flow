type ErrorPageProps = {
  readonly error: Error;
  readonly reset: () => void;
};

const ErrorPage = (props: ErrorPageProps) => (
  <div class="h-screen flex flex-col items-center justify-center">
    <div class="flex flex-col gap-2 p-4 rounded-md text-sm">
      <h1 class="text-5xl mb-3">Something Went Wrong</h1>
      <p class="mb-4">We experienced a crash. Below is the cause.</p>
      <pre class="flex flex-col gap-2 bg-muted p-4 rounded-md text-sm">
        <code>{props.error.message}</code>
        <code>{props.error.stack}</code>
      </pre>
    </div>
  </div>
);

export default ErrorPage;
