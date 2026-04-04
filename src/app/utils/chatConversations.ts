import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationRow = {
  id: string;
  participant_a: string;
  participant_b: string;
};

/** Find a row where participants are (a,b) in either order. */
export async function findConversationByPair(
  supabase: SupabaseClient,
  userA: string,
  userB: string,
): Promise<ConversationRow | null> {
  const { data: row1, error: e1 } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("participant_a", userA)
    .eq("participant_b", userB)
    .maybeSingle();

  if (e1) throw e1;
  if (row1) return row1 as ConversationRow;

  const { data: row2, error: e2 } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("participant_a", userB)
    .eq("participant_b", userA)
    .maybeSingle();

  if (e2) throw e2;
  return (row2 as ConversationRow | null) ?? null;
}

export function otherParticipantId(conv: ConversationRow, me: string): string | null {
  if (conv.participant_a === me) return conv.participant_b;
  if (conv.participant_b === me) return conv.participant_a;
  return null;
}
