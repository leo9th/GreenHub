import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Send, MoreVertical, Phone } from "lucide-react";
import { getAvatarUrl } from "../utils/getAvatar";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
};

type ChatMessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function otherParticipant(conv: ConversationRow, me: string): string {
  return conv.participant_a === me ? conv.participant_b : conv.participant_a;
}

export default function Chat() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<ConversationRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Member");
  const [peerAvatar, setPeerAvatar] = useState<string>("");
  const [peerPhone, setPeerPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const resolveConversation = useCallback(async () => {
    if (!authUser?.id || !routeId?.trim()) {
      setConversation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const param = routeId.trim();

      const { data: byId, error: errById } = await supabase
        .from("conversations")
        .select("id, participant_a, participant_b")
        .eq("id", param)
        .maybeSingle();

      if (errById) throw errById;

      let conv: ConversationRow | null = (byId as ConversationRow | null) ?? null;
      let peer: string | null = null;

      if (conv) {
        const o = otherParticipant(conv, authUser.id);
        if (o !== authUser.id) peer = o;
      }

      if (!conv) {
        const peerCandidate = param;
        if (peerCandidate === authUser.id) {
          toast.error("Invalid chat link.");
          setConversation(null);
          setLoading(false);
          return;
        }

        const orFilter = `and(participant_a.eq.${authUser.id},participant_b.eq.${peerCandidate}),and(participant_a.eq.${peerCandidate},participant_b.eq.${authUser.id})`;
        const { data: existing, error: exErr } = await supabase
          .from("conversations")
          .select("id, participant_a, participant_b")
          .or(orFilter)
          .maybeSingle();

        if (exErr) throw exErr;

        if (existing) {
          conv = existing as ConversationRow;
          peer = peerCandidate;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("conversations")
            .insert({ participant_a: authUser.id, participant_b: peerCandidate })
            .select("id, participant_a, participant_b")
            .single();

          if (insErr) throw insErr;
          conv = inserted as ConversationRow;
          peer = peerCandidate;
        }
      }

      if (!conv || !peer) {
        setConversation(null);
        setLoading(false);
        return;
      }

      setConversation(conv);
      setPeerId(peer);

      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, gender, phone")
        .eq("id", peer)
        .maybeSingle();

      if (!pErr && prof) {
        const name = (prof.full_name as string)?.trim() || "Member";
        setPeerName(name);
        setPeerAvatar(getAvatarUrl(prof.avatar_url as string | null, prof.gender as string | null, name));
        setPeerPhone(prof.phone != null ? String(prof.phone).trim() || null : null);
      } else {
        setPeerName("Member");
        setPeerAvatar(getAvatarUrl(null, null, "Member"));
        setPeerPhone(null);
      }

      const { data: msgs, error: mErr } = await supabase
        .from("chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;
      setMessages((msgs ?? []) as ChatMessageRow[]);
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not open chat");
      setConversation(null);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id, routeId]);

  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      navigate("/login", { replace: true });
      return;
    }
    void resolveConversation();
  }, [authLoading, authUser, navigate, resolveConversation]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text || !authUser?.id || !conversation) return;

    setSendBusy(true);
    try {
      const { data: inserted, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversation.id,
          sender_id: authUser.id,
          body: text,
        })
        .select("id, sender_id, body, created_at")
        .single();

      if (error) throw error;
      if (inserted) setMessages((prev) => [...prev, inserted as ChatMessageRow]);
      setMessage("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Message not sent");
    } finally {
      setSendBusy(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-600">Loading…</div>
    );
  }

  if (!authUser || !conversation || !peerId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-gray-700 mb-4">Chat could not be loaded.</p>
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-sm font-medium"
        >
          Back to messages
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <button type="button" onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="relative flex-shrink-0">
              <img src={peerAvatar || getAvatarUrl(null, null, peerName)} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-100" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-800">{peerName}</h1>
              <p className="text-xs text-gray-600">Direct message</p>
            </div>
            {peerPhone ? (
              <a href={`tel:${peerPhone.replace(/\s/g, "")}`} className="p-2" aria-label="Call">
                <Phone className="w-5 h-5 text-gray-600" />
              </a>
            ) : (
              <button type="button" className="p-2 opacity-40 cursor-not-allowed" aria-hidden>
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button type="button" className="p-2 opacity-50 cursor-not-allowed" aria-hidden>
              <MoreVertical className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-7xl mx-auto w-full">
        <div className="space-y-4">
          {messages.map((msg) => {
            const mine = msg.sender_id === authUser.id;
            const t = new Date(msg.created_at);
            const timeLabel = Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    mine ? "bg-[#22c55e] text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm border border-gray-200"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <span className={`text-xs mt-1 block ${mine ? "text-white/80" : "text-gray-500"}`}>{timeLabel}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-white border-t border-gray-200 sticky bottom-0 z-40">
        <div className="px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
            </div>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!message.trim() || sendBusy}
              className="p-2 bg-[#22c55e] rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
