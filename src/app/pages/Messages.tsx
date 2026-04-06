import { useEffect } from "react";
import { useNavigate } from "react-router";
import { MessageCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useInboxConversationList } from "../hooks/useInboxConversationList";
import { InboxSplitLayout } from "../components/messaging/InboxSplitLayout";

export default function Messages() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

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
  } = useInboxConversationList(authUser?.id);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void load();
  }, [authLoading, authUser, navigate, load]);

  if (authLoading || (!authUser && !loadError)) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gray-50 text-sm text-gray-600">
        Loading…
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  return (
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
  );
}
