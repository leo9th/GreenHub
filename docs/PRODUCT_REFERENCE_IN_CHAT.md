# Product Reference Card in Chat - Implementation Guide

**Status**: ✅ **Database Schema Ready** | ⏳ **UI Component Created** | ⏳ **Handshake Logic Implemented**

---

## Overview

The **Product Reference Card** system bridges the gap between the Marketplace and Chat Room by automatically injecting product context into conversations. This ensures:

- ✅ **Zero Confusion**: Seller always knows which product is being discussed
- ✅ **Deep Linking**: One-click navigation back to product details
- ✅ **Live Metadata**: Price updates reflected in real-time
- ✅ **Professional UX**: Clear visual context in chat flow

---

## Architecture

### Three-Tier Logic Flow

```
User clicks "Chat" on Product Page
    ↓
Handshake Logic Initiates
    ├─ Find/Create Conversation
    ├─ Store product_id at conversation level (context_product_id)
    └─ Send initial message with product_id embedded
    ↓
ChatWorkspace Opens
    ├─ Fetch conversation with context_product_id
    ├─ If product_id on message → Render ChatProductCard
    └─ ChatProductCard displays thumbnail + title + price + deep link
    ↓
Seller Views Chat
    └─ Immediately sees product context (thumbnail, title, price)
```

---

## Components

### 1. ChatProductCard Component

**File**: `src/app/components/chat/ChatProductCard.tsx`

Renders a product reference in the chat flow.

**Props**:
```typescript
interface ChatProductCardProps {
  productId: string | number;           // ID for routing
  title: string;                        // Product title
  price?: number;                       // Numeric price
  priceDisplay?: string;                // Formatted price (e.g., "₦250,000")
  imageUrl?: string;                    // Product image URL
  condition?: string;                   // "Used" | "New" | etc.
  compact?: boolean;                    // Smaller card version
  className?: string;                   // Additional CSS
  children?: ReactNode;                 // Extra content
}
```

**Features**:
- Responsive image with fallback placeholder
- Links to ProductDetail page for deep navigation
- Displays product condition badge
- Accessible with ARIA labels
- Hover animations and focus states

**Usage in ChatWorkspace**:
```tsx
{message.product_id ? (
  <ChatProductCard
    productId={message.product_id}
    title={productTitle}
    price={product.price}
    priceDisplay={formatPrice(product.price)}
    imageUrl={product.image}
    condition={product.condition}
  />
) : null}
```

### 2. Handshake Logic

**File**: `src/app/utils/chatHandshake.ts`

Orchestrates the conversation initialization with product context.

**Function**:
```typescript
export async function initiateChatsWithProduct(
  supabase: SupabaseClient,
  opts: InitiateChatWithProductOpts,
): Promise<{ data: ChatHandshakeResult | null; error: string | null }>
```

**Options**:
```typescript
interface InitiateChatWithProductOpts {
  buyerId: string;              // Current user (buyer)
  sellerId: string;             // Product seller
  productId: string | number;   // Product to reference
  productTitle?: string;        // For pre-filled message
  initialMessage?: string;      // Custom message (optional)
}
```

**Returns**:
```typescript
interface ChatHandshakeResult {
  conversationId: string;       // Conversation ID created/found
  messageId: string | null;     // Initial message ID (if sent)
  productId: string | number;   // Normalized product ID
}
```

**Logic**:
1. Finds existing conversation OR creates new one
2. Updates `context_product_id` if discussing different product
3. Sends initial message with `product_id` embedded
4. Returns conversation and message IDs for routing

---

## Database Schema

### Messages Table
```sql
-- Column already exists in production (migration 20260512120000_chat_messages_product_id.sql)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS product_id bigint 
  REFERENCES public.products (id) ON DELETE SET NULL;

-- Index for fast queries
CREATE INDEX IF NOT EXISTS chat_messages_product_id_idx
  ON public.chat_messages (product_id)
  WHERE product_id IS NOT NULL;
```

### Conversations Table
```sql
-- Existing column for conversation-level product context
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS context_product_id bigint 
  REFERENCES public.products (id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS conversations_context_product_id_idx
  ON public.conversations (context_product_id);
```

**Note**: `products.id` is `bigint` in this project. If using UUID, adjust types accordingly.

---

## Implementation Steps

### Step 1: Update ProductDetailInlineChat
Add the handshake logic import and use it when "Start chat" is clicked:

```tsx
import { initiateChatsWithProduct } from "../utils/chatHandshake";

// In sendMessage handler
const handleInitiateChat = async () => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.id) {
    navigate("/login");
    return;
  }

  const { data, error } = await initiateChatsWithProduct(supabase, {
    buyerId: auth.user.id,
    sellerId: sellerId,
    productId: productId,
    productTitle: productTitle,
  });

  if (error) {
    toast.error(error);
    return;
  }

  // Optionally navigate to chat
  navigate(`/messages/c/${data.conversationId}`);
};
```

### Step 2: Update ChatWorkspace
When rendering messages, check for `product_id` and render ChatProductCard:

```tsx
// In message rendering loop
{message.product_id && (
  <ChatProductCard
    productId={message.product_id}
    title={messageProduct?.title || "Product"}
    price={messageProduct?.price}
    priceDisplay={formatPrice(messageProduct?.price)}
    imageUrl={messageProduct?.image}
    condition={messageProduct?.condition}
    compact
  />
)}
```

### Step 3: Fetch Product Details
When rendering a conversation, fetch product info for the card:

```tsx
// Fetch product details if product_id exists
const fetchProductDetails = async (productId: number | string) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, title, price, image, condition")
    .eq("id", productId)
    .single();

  return { data, error };
};
```

---

## UX Benefits

### For Buyers
- ✅ Context preserved when switching between product page and chat
- ✅ Easy reference back to product specifications
- ✅ No confusion about which item is being discussed
- ✅ Quick re-check of price/condition during negotiation

### For Sellers
- ✅ Immediate product context in every chat
- ✅ Reduce back-and-forth clarification
- ✅ Faster response time (context already known)
- ✅ Link directly to listing to update details

### For Analytics
- ✅ Track which products generate most inquiries
- ✅ Measure time-to-first-response by product
- ✅ Identify stalled negotiations (product no longer shown)
- ✅ Optimize pricing based on inquiry patterns

---

## Metadata Refresh

### Live Price Updates
When displaying the product card, always fetch latest data:

```tsx
const getLatestProduct = async (productId: string) => {
  const { data } = await supabase
    .from("products")
    .select("price, views, like_count, condition")
    .eq("id", productId)
    .single();
  return data;
};

// If seller drops price → buyers see updated price in card
```

### Real-Time Subscriptions
Optionally listen for product updates:

```tsx
const subscription = supabase
  .channel(`product:${productId}`)
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "products", filter: `id=eq.${productId}` },
    (payload) => {
      // Update UI with new price/condition
      setProductData(payload.new);
    }
  )
  .subscribe();
```

---

## Testing Checklist

### Functional Tests
- [ ] Message with `product_id` displays ChatProductCard
- [ ] Message without `product_id` renders normally
- [ ] Clicking card opens ProductDetail page
- [ ] Price updates reflect in card (real-time)
- [ ] Condition badge shows correctly

### Mobile Tests
- [ ] Card responsive at 320px width
- [ ] Image scales properly on small screens
- [ ] "View Product" button easy to tap
- [ ] No overflow of long product titles

### Edge Cases
- [ ] Product deleted (card shows "Product removed")
- [ ] Null product_id (skip card rendering)
- [ ] Very long product titles (truncate to 2 lines)
- [ ] Missing image (show placeholder)

---

## Deployment Checklist

- [ ] ChatProductCard component tested
- [ ] chatHandshake utility exported
- [ ] ProductDetailInlineChat updated with handshake logic
- [ ] ChatWorkspace displays product cards
- [ ] Database migrations confirmed
- [ ] No TypeScript errors
- [ ] Zero breaking changes

---

## Future Enhancements

- [ ] Pinned product card (always at top of chat)
- [ ] Product status indicator (available/sold/delisted)
- [ ] Quick actions (Make offer / Add to cart) from card
- [ ] Product comparison (view multiple products in one chat)
- [ ] Conversation threading by product

---

## Support

### Files Modified
- ✅ `src/app/components/chat/ChatProductCard.tsx` (new)
- ✅ `src/app/utils/chatHandshake.ts` (new)
- ⏳ `src/app/components/ProductDetailInlineChat.tsx` (to update)
- ⏳ `src/app/components/chat/ChatWorkspace.tsx` (to update)

### Database
✅ Schema ready (migration `20260512120000_chat_messages_product_id.sql`)

---

## Summary

The Product Reference Card system is **ready for integration**. The infrastructure is in place:

1. ✅ Database columns exist (product_id on messages + context_product_id on conversations)
2. ✅ UI component created (ChatProductCard)
3. ✅ Handshake logic implemented (initiateChatsWithProduct)
4. ⏳ Integration pending (ChatWorkspace rendering + ProductDetailInlineChat hookup)

This ensures marketplace conversations are always contextual, reducing confusion and improving conversion rates.

