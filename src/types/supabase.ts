/**
 * Supabase generated-style `Database` type.
 *
 * **Regenerate from your running local stack** (Docker + `supabase start`):
 * ```bash
 * npx supabase gen types typescript --local > src/types/supabase.ts
 * ```
 *
 * Or from the linked project (after `supabase login`):
 * ```bash
 * npx supabase gen types typescript --project-id <project-ref> > src/types/supabase.ts
 * ```
 *
 * The block below keeps `chat_messages.product_id` as `string | null` (UUID FK) so inserts/selects
 * match Postgres when `products.id` is uuid. A generic table fallback preserves `.from("…")` for
 * other tables until you replace this file with full CLI output.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

/** Row shape for `public.chat_messages` when `product_id` references uuid `products.id`. */
export type ChatMessagesRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  reply_to_id: string | null;
  image_url: string | null;
  media_url: string | null;
  edited: boolean;
  edited_at: string | null;
  deleted_for_everyone: boolean;
  deleted_for: string[] | null;
  status: string;
  delivered_at: string | null;
  read_at: string | null;
  /** Listing attachment; uuid when `products.id` is uuid */
  product_id: string | null;
};

export type ChatMessagesInsert = {
  id?: string;
  conversation_id: string;
  sender_id: string;
  message?: string;
  created_at?: string;
  reply_to_id?: string | null;
  image_url?: string | null;
  media_url?: string | null;
  edited?: boolean;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
  deleted_for?: string[] | null;
  status?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  product_id?: string | null;
};

export type ChatMessagesUpdate = Partial<ChatMessagesInsert>;

type CoreTables = {
  chat_messages: {
    Row: ChatMessagesRow;
    Insert: ChatMessagesInsert;
    Update: ChatMessagesUpdate;
    Relationships: [];
  };
};

export type Database = {
  public: {
    Tables: CoreTables & { [tableName: string]: GenericTable };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
