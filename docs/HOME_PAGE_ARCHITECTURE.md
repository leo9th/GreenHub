# GreenHub Home Page - Two-Dimensional Infinite Scroll Architecture

## Overview

The GreenHub Home page implements a sophisticated **Two-Dimensional Infinite Scroll** layout that combines:
- **Vertical scrolling** through category rows
- **Horizontal scrolling** (snappable) within each row
- **Independent pagination** for each category
- **Seamless product exploration** across the entire catalog

This creates an intuitive, app-like experience where users can explore products both across different categories and within specific categories without page reloads.

---

## Architecture

### State Structure

```typescript
// Multi-stream state management
type CategoryRowState = {
  products: ProductWithSeller[];      // Products in this category
  nextPage: number;                   // Page index for next pagination
  hasMore: boolean;                   // Whether more products exist
  loading: boolean;                   // Initial load in progress
  loadingMore: boolean;               // Pagination in progress
  error: string | null;               // Error message if any
};

// State dictionary keyed by category slug
const [rowBySlug, setRowBySlug] = useState<Record<string, CategoryRowState>>({});
```

### Key Constants

```typescript
const ROW_PAGE_SIZE = 10;  // Products per horizontal page per category
```

---

## UI Implementation

### Vertical Dimension (Full-Page Scroll)

```tsx
<div className="min-h-screen bg-gray-50">
  <div className="mx-auto max-w-7xl px-4 py-6">
    {/* Category Rows stack vertically */}
    <div className="space-y-2">
      {slugsToShow.map((slug) => (
        <CategoryRow key={slug} slug={slug} {...} />
      ))}
    </div>
  </div>
</div>
```

**Behavior**:
- User scrolls up/down to browse different categories
- All rows are visible simultaneously (no tab-switching)
- Smooth page scroll with standard iOS momentum

### Horizontal Dimension (Snap-Aligned Scroll)

Each category row features:

```tsx
<div className="snap-x snap-mandatory scrollbar-hide [-webkit-overflow-scrolling:touch]">
  {/* Cards render with snap alignment */}
  {products.map((product) => (
    <div className="w-[160px] shrink-0 snap-start sm:w-[180px]">
      <ProductCard {...product} />
    </div>
  ))}
  {/* Load More sentinel */}
  <div className="snap-start">Load more button</div>
</div>
```

**CSS Classes**:
- `snap-x` - Enable horizontal snap
- `snap-mandatory` - Snap is required (not optional)
- `snap-start` - Cards align to snap container start
- `scrollbar-hide` - Hide scrollbar while maintaining swipe
- `[-webkit-overflow-scrolling:touch]` - iOS momentum scrolling

**Card Sizing**:
- Mobile: 160px width
- Desktop (sm+): 180px width
- `shrink-0` - Prevents flex shrinking
- Maintains aspect ratio via ProductCard

---

## Data Flow

### Initial Load

```
User arrives at Home page
    ↓
selectedCategory = "All"
    ↓
slugsToShow = [all category IDs]
    ↓
rowBySlug initialized with empty CategoryRowStates
    ↓
loadPageForSlug(slug, 0, false) called for each category
    ↓
Supabase queries: SELECT * WHERE status='active' AND category=slug
    ↓
Results populate rowBySlug[slug].products
```

### Category Filtering

```
User selects category from CategoryFilter
    ↓
selectedCategory = "Fashion" (example)
    ↓
slugsToShow = ["fashion-clothing"]
    ↓
rowBySlug resets (other categories cleared)
    ↓
loadPageForSlug("fashion-clothing", 0, false)
    ↓
Only "Fashion" row is rendered
```

### Pagination in Single Row

```
User swipes right in "Fashion" row
    ↓
Scrolls to Load More button
    ↓
IntersectionObserver detects sentinel
    ↓
onLoadMore("fashion-clothing") triggered
    ↓
loadPageForSlug("fashion-clothing", 1, true)
    ↓
Supabase queries next 10 products
    ↓
Products APPENDED to existing products (append: true)
    ↓
No other categories affected
    ↓
Other rows continue scrolling independently
```

---

## Supabase Integration

### Query Pattern

```typescript
async function fetchCategoryPage(categorySlug: string, pageIndex: number) {
  const from = pageIndex * ROW_PAGE_SIZE;        // Calculate offset
  const to = from + ROW_PAGE_SIZE - 1;            // Calculate limit

  const { data, error } = await supabase
    .from("products")
    .select("*, seller:profiles!products_seller_id_fkey(full_name, avatar_url, rating)")
    .eq("status", "active")                       // Only active products
    .eq("category", categorySlug)                 // Category-specific
    .order("created_at", { ascending: false })    // Newest first
    .range(from, to);                             // Pagination

  return { rows: data ?? [], error };
}
```

### Why This Works

1. **Efficient Queries**: Each category only fetches what's needed
2. **Segregated Data**: `.eq("category", categorySlug)` keeps rows separate
3. **Pagination**: `.range(from, to)` loads 10 items at a time
4. **Seller Data**: `seller:profiles` fetch includes seller info for cards
5. **Sorting**: `order("created_at")` shows newest products first

---

## Component Hierarchy

```
Home
├─ CategoryFilter
│  └─ Updates selectedCategory state
│
└─ CategoryRow (rendered for each slug in slugsToShow)
   ├─ Horizontal scroll container
   ├─ ProductCard × ROW_PAGE_SIZE
   ├─ Load More button (if hasMore)
   └─ IntersectionObserver (detects Load More sentinel)
      └─ Triggers pagination
```

---

## Key Features

### 1. Independent Pagination
```typescript
// Each category has its own state
rowBySlug["fashion-clothing"].nextPage = 1
rowBySlug["electronics"].nextPage = 2  // Independently tracking
```
- User scrolls Fashion row to page 2
- Electronics row still shows page 1
- No interference between categories

### 2. Snap Alignment
```css
/* snap-x + snap-mandatory ensures perfect alignment */
Container has snap-x snap-mandatory
Cards have snap-start
→ Cards always snap to perfect positions
→ Never gets stuck between cards
```

### 3. Scrollbar-Free UX
```css
.scrollbar-hide {
  scrollbar-width: none;          /* Firefox */
  -ms-overflow-style: none;       /* IE & Edge */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;                  /* Webkit browsers */
}
```
- Completely hidden scrollbar
- Maintains full swipe/drag functionality
- App-like aesthetic

### 4. Mobile Responsiveness
```
Mobile (< sm):   160px cards
Desktop (sm+):   180px cards via: w-[160px] sm:w-[180px]
```

### 5. Error Handling
```typescript
if (error) {
  return {
    [categorySlug]: {
      ...base,
      error: error.message,
      hasMore: false,
      loading: false,
    }
  }
}
```
- Error message displayed above row
- No crash or freeze
- User can retry or explore other categories

### 6. Loading States
```
Initial load:    5 skeleton cards animate while fetching
Pagination:      "Loading…" text in Load More sentinel
Empty category:  "No products in this category yet."
```

---

## Intersection Observer for Pagination

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      const hit = entries.some((e) => e.isIntersecting);
      if (hit) onLoadMore(slug);
    },
    { 
      root: scrollRef.current,           // Observe within this scroll container
      rootMargin: "120px",               // Start loading 120px before visible
      threshold: 0                       // Trigger at any intersection
    }
  );
  
  observer.observe(sentinelRef.current); // Watch Load More button
  return () => observer.disconnect();
}, [slug, row.hasMore, row.loading, row.loadingMore, onLoadMore]);
```

**How it works**:
1. Sentinel div at end of row is watched
2. When sentinel enters viewport (with 120px margin), callback fires
3. `onLoadMore(slug)` triggers pagination for that category only
4. No other rows affected

---

## Performance Optimizations

### 1. Memoized Category Selection
```typescript
const slugsToShow = useMemo(() => {
  // Recomputed only when selectedCategory changes
  if (selectedCategory === "All") return categories.map((c) => c.id);
  const one = categoryFilterLabelToDbValue(selectedCategory);
  return one ? [one] : [];
}, [selectedCategory]);
```

### 2. Callback Memoization
```typescript
const loadPageForSlug = useCallback(async (...) => {
  // Stable reference - dependencies never change
}, []);

const handleLoadMoreRow = useCallback((...) => {
  // Stable reference - prevents re-renders
}, [loadPageForSlug]);
```

### 3. Lazy Loading
- Initial load: 10 products per category
- Pagination: 10 products per fetch
- No preloading of all products
- Database queries are efficient

### 4. Efficient State Updates
```typescript
setRowBySlug((prev) => {
  // Only update the specific category
  return { ...prev, [categorySlug]: newState };
});
```

---

## User Interactions

### Scrolling Up/Down (Vertical)
```
User scrolls page up/down
→ Sees different categories
→ All category data persists in rowBySlug
→ No refetches
```

### Scrolling Left/Right (Horizontal)
```
User swipes/scrolls horizontal in a category row
→ Cards snap into place (snap-mandatory)
→ When reaching end: Load More button visible
→ Click Load More → fetches next 10 products
→ Other rows unaffected
```

### Changing Category Filter
```
User taps "Fashion" in CategoryFilter
→ slugsToShow = ["fashion"]
→ Other categories' rows removed from DOM
→ "Fashion" row loads/renders
→ Can switch back to "All" → all rows reappear (with cached data)
```

---

## Data Persistence

### What Stays in Memory
- `rowBySlug` state persists for filtered categories
- Switching back to "All" shows all cached data
- No additional fetches for cached categories

### What Gets Cleared
- Unfiltered categories remain in state but not rendered
- No memory waste from rendering hidden rows
- Clean category switch experience

---

## Edge Cases & Handling

### 1. Empty Category
```
products.length === 0 && !loading
→ Shows "No products in this category yet."
→ Load More button hidden (hasMore: false)
```

### 2. Load Error
```
Supabase returns error
→ error message displayed
→ hasMore set to false
→ Load More button disabled
→ User can retry or explore other categories
```

### 3. Exactly ROW_PAGE_SIZE Products
```
const hasMore = rows.length === ROW_PAGE_SIZE;
→ If received 10, hasMore = true (more might exist)
→ If received < 10, hasMore = false (end of data)
```

### 4. Simultaneous Requests
```
if (row.loading || row.loadingMore) return;
→ Prevents duplicate requests
→ Only one pagination per category at a time
```

---

## CSS Classes Reference

| Class | Purpose |
|-------|---------|
| `snap-x` | Enable horizontal snap scrolling |
| `snap-mandatory` | Snap behavior is required |
| `snap-start` | Cards align to snap start |
| `scrollbar-hide` | Hide scrollbar (custom class) |
| `overflow-x-auto` | Enable horizontal scrolling |
| `overflow-y-hidden` | Hide vertical scrollbar in row |
| `shrink-0` | Prevent flex shrinking |
| `w-[160px]` | Fixed card width (mobile) |
| `sm:w-[180px]` | Fixed card width (desktop+) |
| `[-webkit-overflow-scrolling:touch]` | iOS momentum scrolling |

---

## Browser Support

✅ **Modern Browsers**
- Chrome/Edge: Full support (snap-x, webkit scrollbar hiding)
- Firefox: Full support (scrollbar-width property)
- Safari/iOS: Full support (webkit scrollbar, momentum scrolling)

✅ **Graceful Degradation**
- Older browsers: Show thin scrollbar instead of hidden
- All functionality still works (snapping, pagination)
- No breaking issues

---

## Testing Checklist

- [ ] **Vertical Scroll**: Scroll page up/down, see different categories
- [ ] **Horizontal Snap**: Swipe in row, cards snap to position
- [ ] **Load More**: Scroll to end of row, click Load More
- [ ] **Pagination Independence**: Load in one row, other rows unchanged
- [ ] **Category Filter**: Switch categories, only that row shows
- [ ] **Empty Categories**: No products shows empty message
- [ ] **Scrollbar Hidden**: No scrollbar visible (mobile testing)
- [ ] **Mobile Sizing**: Cards are 160px on mobile
- [ ] **Desktop Sizing**: Cards are 180px on desktop
- [ ] **Error Handling**: Network error shows message
- [ ] **Performance**: Smooth scrolling at 60fps

---

## Future Enhancements

- [ ] Save scroll position per category
- [ ] Lazy-load images in off-screen cards
- [ ] Add animations for page transitions
- [ ] Implement search within horizontal rows
- [ ] Add category favorites/bookmarks
- [ ] Real-time product updates via Supabase subscriptions

---

## Summary

The Two-Dimensional Infinite Scroll architecture provides:

✅ **Intuitive UX** - Explore products both vertically and horizontally  
✅ **Independent Pagination** - Each category loads independently  
✅ **App-Like Feel** - Snap alignment + hidden scrollbar  
✅ **Performance** - Efficient data loading + memoization  
✅ **Scalability** - Works with any number of categories  
✅ **Maintainability** - Clean state structure + component separation  

