import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useInboxConversationList } from "../hooks/useInboxConversationList";
import { InboxSplitLayout } from "../components/messaging/InboxSplitLayout";

function MessagesErrorBoundary({ children }: { children: React.ReactNode }) {
  // Simple client-side boundary to keep the messages page from crashing.
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
      console.error("Messages boundary caught:", error, info);
    }
    render() {
      if (this.state.error) {
        return (
          <div className="min-h-[calc(100dvh-4rem)] bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-inner">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
            <p className="mt-2 max-w-md text-sm text-gray-600">
              We couldn&apos;t load your messages. Please retry. If this keeps happening, try signing out and back in.
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
              >
                Reload
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Go home
              </button>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  return <Boundary>{children}</Boundary>;
}

export default function Messages() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const authUserId = authUser?.id;

  const {
    search,
    setSearch,
    loadError,
    loading,
    filtered,
    profiles,
    productTitles,
    unreadByConv,
    load,
    otherPartyUserId,
  } = useInboxConversationList(authUserId);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gray-50 text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
          <MessageCircle className="h-10 w-10 text-[#22c55e]" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Please sign in to view messages</h2>
        <p className="mt-2 max-w-sm text-sm text-gray-600">
          Messages are available to signed-in buyers and sellers.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a]"
          >
            Go to login
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <MessagesErrorBoundary>
      <div className="min-h-[calc(100dvh-4rem)] bg-gray-50">
        <InboxSplitLayout
          listVariant="full"
          onListBack={() => navigate(-1)}
          search={search}
          onSearchChange={setSearch}
          loadError={loadError}
          loading={loading}
          filtered={filtered}
          profiles={profiles}
          productTitles={productTitles}
          unreadByConv={unreadByConv}
          otherPartyUserId={otherPartyUserId}
          rightPanel={
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50 px-6 py-12 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-200">
                <MessageCircle className="h-10 w-10 text-[#22c55e]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800">Select a conversation</h2>
              <p className="mt-2 max-w-sm text-sm text-gray-600">
                Choose a chat on the left to read and reply. Your inbox updates live.
              </p>
            </div>
          }
        />
      </div>
    </MessagesErrorBoundary>
  );
}
