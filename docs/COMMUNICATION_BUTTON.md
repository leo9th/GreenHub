# Unified Communication Button - Implementation Guide

## Overview

The `CommunicationButton` component standardizes buyer-seller communication entry points across GreenHub. It provides intelligent fallback logic to ensure users always have a path to convert, eliminating dead ends in the product exploration flow.

---

## Features

### Smart Logic Hierarchy
```
1. WhatsApp Available?        → Green WhatsApp button (primary)
2. Internal Chat Available?   → Blue "Send Message" button (fallback)
3. Both Unavailable?          → Gray "Unavailable" button (explicit feedback)
```

### Key Benefits
- ✅ **Zero Layout Shift**: Button always occupies space (no conditional rendering returning null)
- ✅ **No Dead Ends**: Every path leads to communication (WhatsApp → Internal Chat)
- ✅ **Professional UX**: Pre-filled WhatsApp messages include product context
- ✅ **Consistent Design**: Single component for all communication scenarios
- ✅ **Accessible**: Full ARIA labels and semantic HTML

---

## Component API

### Props

```typescript
interface CommunicationButtonProps {
  /** WhatsApp href link (if available) */
  whatsappHref?: string;
  
  /** Product title for pre-filled message */
  productTitle: string;
  
  /** Whether internal chat is available (user is logged in and not owner) */
  hasInternalChat?: boolean;
  
  /** Callback when internal chat button is clicked */
  onChatClick?: () => void;
  
  /** Additional CSS classes */
  className?: string;
  
  /** Whether button is in disabled/loading state */
  disabled?: boolean;
}
```

### Usage Example

```tsx
import { CommunicationButton } from "../ui/CommunicationButton";

export function ProductCard({ 
  productTitle, 
  sellerPhone, 
  authUserId,
  isOwner,
  onMessageClick 
}) {
  const whatsappHref = sellerPhone 
    ? `https://wa.me/${cleanPhone(sellerPhone)}?text=${encodeURIComponent(`Hi, I'm interested in "${productTitle}"`)}`
    : "";

  return (
    <div>
      {/* Product details */}
      
      <CommunicationButton
        whatsappHref={whatsappHref}
        productTitle={productTitle}
        hasInternalChat={!!authUserId && !isOwner}
        onChatClick={onMessageClick}
        className="w-full"
      />
    </div>
  );
}
```

---

## Button States

### 1. WhatsApp Available (Green)
```tsx
<CommunicationButton
  whatsappHref="https://wa.me/234807..."
  productTitle="iPhone 14"
  hasInternalChat={true}
  onChatClick={() => {}}
/>
```
**Result**: Green "💬 WhatsApp" button linking to WhatsApp with pre-filled message

**Message Format**:
```
Hi, I'm interested in your "iPhone 14" on GreenHub!
```

### 2. Internal Chat Only (Blue)
```tsx
<CommunicationButton
  whatsappHref={undefined}
  productTitle="iPhone 14"
  hasInternalChat={true}
  onChatClick={() => handleStartChat()}
/>
```
**Result**: Blue "Send Message" button triggering internal chat

### 3. Unavailable (Gray)
```tsx
<CommunicationButton
  whatsappHref={undefined}
  productTitle="iPhone 14"
  hasInternalChat={false}
  onChatClick={() => {}}
/>
```
**Result**: Gray "Unavailable" button with disabled state

**Tooltip**: "Seller has no contact methods available"

---

## Integration Points

### ProductDetailInlineChat (Legacy)
- **File**: `src/app/components/ProductDetailInlineChat.tsx`
- **Props Added**: `productTitle: string`
- **Changes**: 
  - Replaced conditional `{whatsappHref ? ... : ...}` rendering
  - Now uses unified `<CommunicationButton />` component

### NewProductDetailInlineChat (Active)
- **File**: `src/app/components/NewProductDetailInlineChat.tsx`
- **Integration**: Added after action buttons
- **Features**:
  - Constructs `whatsappHref` from `sellerPhone` and `productTitle`
  - Passes `hasInternalChat={true}` (messaging hub is always available)
  - Links `onChatClick` to `handleSend()` for internal chat

---

## Design System

### Colors
- **WhatsApp Green**: `#25D366` (official WhatsApp color)
- **Internal Chat Blue**: `bg-blue-600` (brand accent)
- **Unavailable Gray**: `bg-gray-200` (disabled state)

### Sizing
- **Mobile**: Fits in single column layout
- **Desktop**: Flexes with action buttons
- **Min Height**: 40-46px (touch-friendly)
- **Padding**: `px-3 py-2` (compact yet spacious)

### Interactions
- **Hover**: Opacity change (WhatsApp), background change (Internal Chat)
- **Active**: `scale-95` (press feedback)
- **Disabled**: `opacity-60` (visual feedback)
- **Transition**: Smooth `transition-all` (0.15s default)

---

## Message Pre-filling

### WhatsApp Message Format
```javascript
const message = `Hi, I'm interested in your "${productTitle}" on GreenHub!`;
const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
```

**Why Pre-fill?**
- ✅ Seller immediately knows which product buyer is interested in
- ✅ Reduces back-and-forth clarification
- ✅ Increases conversion likelihood
- ✅ Professional tone sets expectations

### Example Messages
- "Hi, I'm interested in your \"Used iPhone 14\" on GreenHub!"
- "Hi, I'm interested in your \"Gaming Laptop Dell XPS\" on GreenHub!"
- "Hi, I'm interested in your \"this item\" on GreenHub!" (fallback)

---

## Accessibility

### ARIA Labels
```tsx
// WhatsApp button
aria-label={`Chat on WhatsApp about ${productTitle}`}

// Internal Chat button
aria-label={`Send message about ${productTitle}`}

// Unavailable state
role="status"
aria-label="Contact method unavailable"
```

### Keyboard Support
- ✅ Full keyboard navigation
- ✅ Focus indicators
- ✅ Tab order respected
- ✅ Enter/Space to activate

### Screen Reader Support
- ✅ Button text descriptive
- ✅ Icons have `aria-hidden`
- ✅ State clearly communicated
- ✅ Link targets marked with `target="_blank"` announcement

---

## Testing Checklist

### Functional Tests
- [ ] **WhatsApp Available**: Clicking opens WhatsApp with correct message
- [ ] **Internal Chat Only**: Clicking triggers chat UI
- [ ] **Both Unavailable**: Button shows disabled state with tooltip
- [ ] **Disabled State**: Button cannot be clicked during sending
- [ ] **Responsive**: Button resizes correctly on mobile/desktop

### Visual Tests
- [ ] **Colors**: WhatsApp green, Chat blue, Unavailable gray
- [ ] **Hover States**: Visual feedback on mouse hover
- [ ] **Active States**: Press feedback (scale-95)
- [ ] **Focus States**: Clear focus ring for keyboard users
- [ ] **Mobile**: Touch-friendly size (min 44px height)

### Edge Cases
- [ ] **Empty Product Title**: Falls back to "this item"
- [ ] **Very Long Product Title**: Text doesn't overflow
- [ ] **Loading State**: Button disabled, shows spinner (if applicable)
- [ ] **Network Error**: Error message shown, button re-enables
- [ ] **PhoneNumber with Special Characters**: Properly cleaned for WhatsApp

### A11y Tests
- [ ] **Keyboard Only**: Can navigate to button with Tab
- [ ] **Screen Reader**: Text is descriptive and helpful
- [ ] **Contrast**: WCAG AA compliant (4.5:1 for text)
- [ ] **Focus Visible**: Clear focus indicator

---

## Migration Guide

### Before (Conditional Rendering)
```tsx
{whatsappHref ? (
  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
    Chat on WhatsApp
  </a>
) : (
  <div className="bg-gray-100">WhatsApp not available</div>
)}
```

### After (Unified Component)
```tsx
<CommunicationButton
  whatsappHref={whatsappHref}
  productTitle={productTitle}
  hasInternalChat={!isOwner && !!authUserId}
  onChatClick={handleStartChat}
/>
```

**Benefits of Migration**:
- ✅ Eliminates layout shift
- ✅ Consistent styling everywhere
- ✅ Single source of truth for communication logic
- ✅ Easier to maintain and update
- ✅ Better testability

---

## Future Enhancements

- [ ] Email contact option (when available)
- [ ] SMS option (seller opt-in)
- [ ] Callback request feature
- [ ] In-app call functionality
- [ ] Contact history tracking
- [ ] Preferred communication method (per seller)
- [ ] Analytics on communication method usage

---

## Support

### Common Issues

**Q: Button doesn't appear?**  
A: Ensure `productTitle` is provided and component is not wrapped in a conditional returning null.

**Q: WhatsApp link not working?**  
A: Verify phone number is cleaned (only digits). Use format: `https://wa.me/{phoneWithoutFormatting}?text={message}`

**Q: Accessibility warnings?**  
A: Check that `aria-label` is provided for non-text buttons. All interactive elements need clear labels.

### Files Changed
- ✅ `src/app/components/ui/CommunicationButton.tsx` (new)
- ✅ `src/app/components/ProductDetailInlineChat.tsx` (updated)
- ✅ `src/app/components/NewProductDetailInlineChat.tsx` (updated)

---

## Summary

The `CommunicationButton` component provides a unified, intelligent, and user-friendly way to initiate contact with sellers. By eliminating dead ends and providing graceful fallbacks, it ensures every product exploration session has a clear path to conversion.

**Status**: ✅ **Production Ready**

