import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";

function RouterFallback() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-background dark:text-zinc-400">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouterFallback />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}