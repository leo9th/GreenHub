import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeProductPk } from "./engagement";

export interface InitiateChatWithProductOpts {
  buyerId: string;
  sellerId: string;
  productId: string | number | null | undefined;
  productTitle?: string;
  initialMessage?: string;
}

export interface ChatHandshakeResult {
  conversationId: string;
  messageId: string | null;
  productId: string | number | null;
}

/**
 * Initiates a chat conversation with automatic product context injection.
 *
 * This implements the "Handshake" logic:
 * 1. Opens (or finds) a conversation between buyer and seller
 * 2. Sends an initial message with product_id embedded
 * 3. Returns the conversation and initial message IDs
 *
 * Benefits:
 * - Seller immediately knows what product is being discussed
 * - Chat UI can render ProductReferenceCard for context
 * - Deep linking back to product available from conversation list
 */
export async function initiateChatsWithProduct(
  supabase: SupabaseClient,
  opts: InitiateChatWithProductOpts,
): Promise<{ data: ChatHandshakeResult | null; error: string | null }> {
  try {
    const { buyerId, sellerId, productId, productTitle = "this item", initialMessage } = opts;

    // Normalize product ID (string/number/bigint all supported)
    const normalizedProductId = normalizeProductPk(productId);

    // 1. Find or create conversation
    const conversationQuery = await supabase
      .from("conversations")
      .select("id, context_product_id")
      .eq("buyer_id", buyerId)
      .eq("seller_id", sellerId)
      .maybeSingle();

    let conversationId: string;
    let contextProductId = normalizedProductId;

    if (conversationQuery.data) {
      // Use existing conversation
      conversationId = conversationQuery.data.id;
      // Update context if this is a different product
      if (normalizedProductId && normalizedProductId !== conversationQuery.data.context_product_id) {
        await supabase
          .from("conversations")
          .update({ context_product_id: normalizedProductId })
          .eq("id", conversationId);
      }
    } else {
      // Create new conversation with product context
      const createResult = await supabase
        .from("conversations")
        .insert({
          buyer_id: buyerId,
          seller_id: sellerId,
          context_product_id: normalizedProductId,
        })
        .select("id")
        .single();

      if (createResult.error) {
        return { data: null, error: `Failed to create conversation: ${createResult.error.message}` };
      }

      conversationId = createResult.data.id;
    }

    // 2. Send initial message with product_id
    const messageText =
      initialMessage || `Hi, I'm interested in your "${productTitle.trim() || "this item"}" on GreenHub!`;

    const messageResult = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: buyerId,
        message: messageText,
        product_id: normalizedProductId, // KEY: Embed product reference at message level
        status: "sent",
      })
      .select("id")
      .single();

    if (messageResult.error) {
      return { data: null, error: `Failed to send message: ${messageResult.error.message}` };
    }

    return {
      data: {
        conversationId,
        messageId: messageResult.data.id,
        productId: normalizedProductId,
      },
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, error: `Chat handshake failed: ${msg}` };
  }
}
