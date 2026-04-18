# GreenHub Communication Hub Architecture

## Overview

The Communication Hub is GreenHub's unified system for real-time messaging, alerts, and notifications. It powers:
- **Direct Messaging (DM)** between buyers and sellers linked to products
- **In-app Notifications** for messages, alerts, and system events
- **Desktop Notifications** for critical alerts
- **Toast Notifications** for real-time user feedback

---

## Database Schema

### Core Tables

#### 1. **Conversations** (Buyer-Seller DM threads)
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY,
  buyer_id UUID NOT NULL,          -- Buyer user ID
  seller_id UUID NOT NULL,          -- Seller user ID
  context_product_id BIGINT,        -- Optional: Product being discussed
  last_message TEXT,                -- Last message preview
  last_message_at TIMESTAMP,        -- Last message timestamp
  buyer_last_read_at TIMESTAMP,     -- Buyer's last read position
  seller_last_read_at TIMESTAMP,    -- Seller's last read position
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. **Chat Messages** (Individual messages in conversations)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL,    -- Foreign key to conversations
  sender_id UUID NOT NULL,          -- Message sender
  message TEXT NOT NULL,            -- Message content
  media_url TEXT,                   -- Optional: Attached media URL
  image_url TEXT,                   -- Optional: Image attachment
  edited BOOLEAN DEFAULT FALSE,     -- Is message edited?
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. **Notifications** (In-app alerts and messages)
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,            -- Recipient
  type TEXT DEFAULT 'message',      -- 'message', 'price_drop', 'new_order', 'auth_error', etc.
  title TEXT NOT NULL,              -- Notification title
  body TEXT DEFAULT '',             -- Notification body/message
  data JSONB DEFAULT '{}',          -- Additional metadata
  read_at TIMESTAMP,                -- When user read it
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Frontend Architecture

### 1. **NotificationProvider** Context
Located at: `src/app/context/NotificationProvider.tsx`

Provides unified toast notification API across the app.

```typescript
type NotificationType = 
  | "success" | "error" | "info" | "warning" 
  | "message" | "order_update" | "price_drop" | "auth_error";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;  // ms, 0 = persistent
  actionLabel?: string;
  onAction?: () => void;
}
```

### 2. **InboxNotificationsProvider** Context
Located at: `src/app/context/InboxNotificationsContext.tsx`

Handles:
- Real-time notification subscriptions via Supabase channels
- Unread message counts
- Desktop notifications
- Auto-refresh on conversation updates

### 3. **Notification Hooks**
Located at: `src/app/hooks/useNotifications.ts`

Specialized hooks for different use cases:

```typescript
// Message notifications
const messageNotif = useMessageNotification();
messageNotif.notifyNewMessage("John", "Used Laptop");
messageNotif.notifyMessageSent();

// Product notifications
const productNotif = useProductNotification();
productNotif.notifyPriceDrop("iPhone 14", 500000, 450000);

// Order notifications
const orderNotif = useOrderNotification();
orderNotif.notifyOrderConfirmed("ORD-12345");
orderNotif.notifyOrderShipped("ORD-12345");

// Seller notifications
const sellerNotif = useSellerNotification();
sellerNotif.notifyNewProductInquiry("Jane", "Gaming PC");
sellerNotif.notifyVerificationUpdate("approved");

// Engagement notifications
const engagementNotif = useEngagementNotification();
engagementNotif.notifyNewFollower("Mike");
engagementNotif.notifyProfileLiked("Sarah");
```

---

## Integration Points

### SMS OTP Authentication
**File**: `src/app/pages/auth/VerifyOTP.tsx`

Features:
- ✅ 6-digit numeric input with auto-focus
- ✅ 60-second countdown timer (visually prominent)
- ✅ Paste support for OTP codes
- ✅ Auto-verify when all digits entered
- ✅ Integrated with NotificationProvider for auth errors
- ✅ Real-time feedback via unified notification system

### Chat/Messaging System
**File**: `src/app/pages/Chat.tsx` / `src/app/pages/ChatV2.tsx`

Integrates with:
- Conversations table (product-linked DMs)
- Chat messages table (message history)
- Real-time listeners for typing indicators
- Read receipts (buyer_last_read_at, seller_last_read_at)
- Desktop notifications for new messages

### Notifications System
**File**: `src/app/context/InboxNotificationsContext.tsx`

Listens to:
- New notifications (INSERT events)
- Conversation updates (NEW_MESSAGE, READ_RECEIPTS)
- Message notifications (type = "message")
- Real-time unread counts

---

## Usage Examples

### Example 1: Sending a Message with Notification
```typescript
import { useMessageNotification } from "../hooks/useNotifications";

function ChatComponent() {
  const messageNotif = useMessageNotification();

  const sendMessage = async (content: string) => {
    try {
      await supabase
        .from("chat_messages")
        .insert({ conversation_id, sender_id, message: content });
      
      messageNotif.notifyMessageSent();
    } catch (error) {
      messageNotif.notifyMessageFailed(error.message);
    }
  };

  return <input onSend={sendMessage} />;
}
```

### Example 2: SMS Auth Error Handling
```typescript
// VerifyOTP.tsx already integrates this!
const { error } = await supabase.auth.verifyOtp({...});
if (error) {
  notif.authError("Verification Failed", error.message);
}
```

### Example 3: Seller Boost Notification
```typescript
import { useSellerNotification } from "../hooks/useNotifications";

function SellerBoostManager() {
  const sellerNotif = useSellerNotification();

  useEffect(() => {
    // When boost is purchased
    sellerNotif.notifyProductBoostActive("MacBook Pro", 7);
    
    // When boost expires soon
    sellerNotif.notifyProductBoostExpiring("MacBook Pro");
  }, [sellerNotif]);
}
```

### Example 4: Price Drop Alert
```typescript
import { useProductNotification } from "../hooks/useNotifications";

function ProductWatchlist() {
  const productNotif = useProductNotification();

  const checkPriceDrops = async () => {
    const drops = await fetchPriceDrops();
    drops.forEach(drop => {
      productNotif.notifyPriceDrop(drop.name, drop.oldPrice, drop.newPrice);
    });
  };
}
```

---

## Toast Styling & Theming

The app uses **Sonner** for toast notifications with a custom themed wrapper:
- **File**: `src/app/components/ThemedToaster.tsx`
- **Styling**: Automatically adapts to light/dark theme
- **Duration**: Default 4000ms (customizable per notification)

Success toasts show ✓ icon  
Error toasts show ✗ icon  
Info/warning/message toasts show custom icons  

---

## Real-Time Features

### Database Change Subscriptions
The InboxNotificationsContext subscribes to:

```typescript
// Listen for new notifications
supabase.channel(`realtime-notifications:${uid}`)
  .on("postgres_changes", 
    { event: "INSERT", table: "notifications" }, 
    onNotifEvent)
  .subscribe();

// Listen for conversation updates (new messages)
supabase.channel(`realtime-conv-buyer:${uid}`)
  .on("postgres_changes",
    { event: "*", table: "conversations" },
    refreshUnreadCounts)
  .subscribe();
```

### Desktop Notifications
When `type = 'message'`:
```typescript
showDesktopMessageNotification(
  notification.title,
  notification.body,
  notification.id
);
```

---

## Security & Row-Level Security (RLS)

All tables have RLS policies:

### Conversations
- Users can only see conversations where they are buyer OR seller
- Users can only insert/update their own conversations

### Chat Messages
- Users can only see messages in conversations they participate in
- Users can only insert messages they send

### Notifications
- Users can only see their own notifications
- System only inserts notifications for specific users

---

## Performance Optimizations

1. **Indexed queries** on frequently accessed columns:
   - `notifications(user_id, created_at)` for unread
   - `conversations(buyer_id, seller_id)` for lookups
   - `chat_messages(conversation_id, created_at)` for history

2. **Real-time debouncing**: Notification updates are throttled to prevent excessive re-renders

3. **Lazy loading**: Messages and notifications load with pagination

4. **Caching**: Recent notifications cached in context to reduce queries

---

## Migration History

Key migrations related to Communication Hub:

| Migration | Date | Purpose |
|-----------|------|---------|
| `20260411140000` | 2026-04-11 | Conversations & chat_messages tables |
| `20260415100000` | 2026-04-15 | last_message columns on conversations |
| `20260416100000` | 2026-04-16 | context_product_id linking to products |
| `20260418120000` | 2026-04-18 | Chat message columns (media, edit) |
| `20260420120000` | 2026-04-20 | Notifications table & RLS policies |
| `20260514120000` | 2026-05-14 | Typing indicators & presence |

---

## Common Patterns

### Pattern 1: Handle API Errors with Notifications
```typescript
const actionNotif = useActionNotification();

try {
  await apiCall();
  actionNotif.notifyActionSuccess("Action Completed");
} catch (error) {
  actionNotif.notifyActionError("Action Failed", error.message);
}
```

### Pattern 2: Show Loading State
```typescript
const notif = useNotification();

notif.notify({
  type: "info",
  title: "Processing...",
  duration: 0, // Persistent until dismissed
});
```

### Pattern 3: Undo Action with Toast
```typescript
const notif = useNotification();

notif.notify({
  type: "info",
  title: "Item Deleted",
  actionLabel: "Undo",
  onAction: () => restoreItem(),
});
```

---

## Troubleshooting

### Notifications not showing
1. Check NotificationProvider is in main.tsx
2. Verify component is within provider hierarchy
3. Check browser console for errors

### Real-time updates not working
1. Verify Supabase real-time is enabled
2. Check user authentication status
3. Check RLS policies allow user access
4. Look at browser DevTools > Application > Logs

### Desktop notifications not appearing
1. Check browser notification permissions
2. Verify `ensureMessageNotificationPermission()` is called
3. Check notification type is "message"

---

## Future Enhancements

- [ ] Notification preferences (mute, do-not-disturb)
- [ ] Notification history/archive
- [ ] Rich media in notifications (images, buttons)
- [ ] Notification scheduling
- [ ] Read receipts for notifications
- [ ] Notification templates
- [ ] Bulk notification actions

