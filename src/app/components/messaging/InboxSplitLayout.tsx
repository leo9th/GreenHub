import { Link } from "react-router";
import { ArrowLeft, MessageCircle, Search } from "lucide-react";
import { getAvatarUrl } from "../../utils/getAvatar";
import type { ConversationRow, ProfileLite } from "../../hooks/useInboxConversationList";
import { formatListTime } from "../../hooks/useInboxConversationList";

type Props = {
  /** Highlight active thread in the list */
  activeConversationId?: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  loadError: string | null;
  loading: boolean;
  filtered: ConversationRow[];
  profiles: Map<string, ProfileLite>;
  productTitles: Map<number, string>;
  unreadByConv: Map<string, number>;
  otherPartyUserId: (r: ConversationRow) => string | null;
  /**
   * `full` = messages index (list full width on mobile; fixed-width column on md+).
   * `sidebar` = thread view (list hidden on mobile, fixed column on md+).
   */
  listVariant: "full" | "sidebar";
  /** Mobile-only back control in the list header (messages index). */
  onListBack?: () => void;
  rightPanel: React.ReactNode;
};

export function InboxSplitLayout({
  activeConversationId,
  search,
  onSearchChange,
  loadError,
  loading,
  filtered,
  profiles,
  productTitles,
  unreadByConv,
  otherPartyUserId: getOtherId,
  listVariant,
  onListBack,
  rightPanel,
}: Props) {
  const shellHeight = "md:h-[calc(100dvh-4rem)] md:max-h-[calc(100dvh-4rem)]";

  const listColClasses =
    listVariant === "full"
      ? `flex w-full min-h-0 flex-col bg-white ${shellHeight} md:w-[280px] md:shrink-0 lg:w-[320px]`
      : `hidden min-h-0 flex-col border-r border-gray-200 bg-white md:flex ${shellHeight} md:w-[280px] md:shrink-0 lg:w-[320px]`;

  const rightColClasses =
    listVariant === "full"
      ? `hidden min-h-0 flex-1 flex-col md:flex ${shellHeight}`
      : `flex min-h-0 min-w-0 flex-1 flex-col ${shellHeight}`;

  const conversationList = (
    <>
      <div className="shrink-0 border-b border-gray-200 bg-white px-3 py-3">
        <div className="mb-3 flex items-center gap-2">
          {listVariant === "full" && onListBack ? (
            <button
              type="button"
              onClick={onListBack}
              className="-ml-1 rounded-lg p-2 hover:bg-gray-100 md:hidden"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          ) : null}
          <h1 className="text-lg font-semibold text-gray-800">Messages</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg bg-gray-100 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        {loadError ? (
          <div className="px-4 py-8 text-center text-sm text-red-600">{loadError}</div>
        ) : loading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-600">Loading conversations…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
              <MessageCircle className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800">No messages yet</h3>
            <p className="mb-6 text-sm text-gray-600">
              Start chatting with sellers about products you&apos;re interested in
            </p>
            <Link
              to="/products"
              className="inline-block rounded-lg bg-[#22c55e] px-6 py-3 font-medium text-white"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((conversation) => {
              const oid = getOtherId(conversation);
              if (!oid) return null;
              const p = profiles.get(oid);
              const name = p?.full_name?.trim() || "Member";
              const avatar = getAvatarUrl(p?.avatar_url ?? null, p?.gender ?? null, name);
              const aboutProduct =
                conversation.context_product_id != null
                  ? productTitles.get(conversation.context_product_id)
                  : undefined;
              const active = activeConversationId === conversation.id;
              return (
                <Link
                  key={conversation.id}
                  to={`/messages/c/${conversation.id}`}
                  className={`flex items-center gap-3 border-b border-gray-50 p-3 transition-colors hover:bg-gray-50 sm:p-4 ${
                    active ? "bg-emerald-50/80 hover:bg-emerald-50" : ""
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={avatar} alt="" className="h-12 w-12 rounded-full bg-gray-100 object-cover sm:h-14 sm:w-14" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800">{name}</h3>
                      <span className="ml-2 flex shrink-0 items-center gap-1.5">
                        {(unreadByConv.get(conversation.id) ?? 0) > 0 ? (
                          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#22c55e] px-1 text-[10px] font-bold text-white">
                            {unreadByConv.get(conversation.id)! > 99
                              ? "99+"
                              : unreadByConv.get(conversation.id)}
                          </span>
                        ) : null}
                        <span className="text-xs text-gray-500">
                          {formatListTime(conversation.last_message_at)}
                        </span>
                      </span>
                    </div>
                    {aboutProduct ? (
                      <p className="mb-0.5 truncate text-xs font-medium text-[#16a34a]">Re: {aboutProduct}</p>
                    ) : null}
                    <p
                      className={`line-clamp-2 text-sm ${conversation.last_message ? "text-gray-700" : "italic text-gray-400"}`}
                    >
                      {conversation.last_message || "No messages yet — say hello"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex w-full max-w-[1920px] flex-col bg-gray-50 md:mx-auto md:min-h-0 md:flex-row">
      <aside className={listColClasses}>{conversationList}</aside>

      <section className={rightColClasses}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{rightPanel}</div>
      </section>
    </div>
  );
}
