import React from "react";
import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import ChatWorkspace from "../components/chat/ChatWorkspace";

function ChatErrorBoundary({ children }: { children: React.ReactNode }) {
  class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { error: null };
    }
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
      // eslint-disable-next-line no-console
      console.error("Chat boundary caught:", error, info);
    }
    render() {
      if (this.state.error) {
        return (
          <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 text-center dark:bg-background">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-inner dark:bg-red-950/50">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-foreground">Chat encountered a problem</h2>
            <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-muted-foreground">
              We couldn&apos;t render this conversation. Please reload or go back to your inbox.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
              >
                Reload
              </button>
              <Link
                to="/messages"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-border dark:text-foreground dark:hover:bg-muted"
              >
                Back to messages
              </Link>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return <Boundary>{children}</Boundary>;
}

export default function Chat() {
  return (
    <ChatErrorBoundary>
      <ChatWorkspace />
    </ChatErrorBoundary>
  );
}
