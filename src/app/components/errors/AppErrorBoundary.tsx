import React from "react";

type ErrorBoundaryScope = "global" | "section";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  scope?: ErrorBoundaryScope;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundaryInner extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("Error boundary caught:", error, info);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const isGlobal = this.props.scope === "global";
      return (
        <div
          className={
            isGlobal
              ? "flex min-h-screen items-center justify-center bg-gray-50 px-6 text-center"
              : "flex min-h-[50dvh] items-center justify-center rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center"
          }
        >
          <div className="max-w-md">
            <h2 className="text-xl font-semibold text-gray-900">Oops! Something went wrong</h2>
            <p className="mt-2 text-sm text-gray-600">
              {isGlobal
                ? "We hit a snag while loading the app. Please try again."
                : "This checkout section ran into an issue. Please try again."}
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-5 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function AppErrorBoundary({ children, scope = "section" }: AppErrorBoundaryProps) {
  return <AppErrorBoundaryInner scope={scope}>{children}</AppErrorBoundaryInner>;
}
