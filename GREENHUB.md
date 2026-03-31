# GreenHub - Nigerian C2C Marketplace

A comprehensive Nigerian consumer-to-consumer marketplace application built with React, TypeScript, React Router, and Tailwind CSS.

## 🌿 Features

### Brand Identity
- **Colors**: Fresh green (#22c55e) primary, sunshine yellow (#eab308) secondary
- **Mobile-First**: Optimized for 375px mobile screens
- **Nigerian Context**: Naira currency (₦), Nigerian states/LGAs, local banks, delivery services

### Complete Screen Set (23 Screens)

#### 1. Design System
- Full component library showcase
- All brand colors and typography
- Button variants, inputs, badges
- Quick navigation to all screens

#### 2-4. Authentication Flow
- Login with email/phone
- Register with role selection (Buyer/Seller)
- OTP verification with countdown timer
- State and LGA selectors
- Password strength indicator

#### 5-6. Homepage & Products
- Category browser with icons
- Product grid with images, prices, ratings
- Search functionality
- Product filters (category, price, condition, location)
- Sorting options
- Featured and recently viewed sections

#### 7. Product Detail
- Image gallery with thumbnails
- Seller information card
- Condition badges
- Delivery options (Pickup, GIGL, Sendy)
- Safety tips banner
- Chat and call buttons

#### 8-9. Cart & Checkout
- Shopping cart with quantity controls
- Platform fee calculation (10%)
- Multi-step checkout flow
- Address form with state/LGA
- Payment methods:
  - Card (Paystack)
  - Bank Transfer
  - USSD
  - Pay on Delivery
- Payment success screen

#### 10-11. Order Management
- Order list with status tabs
- Order detail with tracking
- Status timeline visualization
- Delivery tracking integration

#### 12-13. Messaging System
- Conversation list with product context
- Real-time chat interface
- Message bubbles (sent/received)
- Typing indicators
- Product cards in chat

#### 14-17. Seller Dashboard
- Sales statistics and earnings
- Product management (list, edit, delete)
- Add/Edit product form with:
  - Multiple image upload
  - Category selection
  - Condition options
  - Delivery settings
- Bank account setup for payouts
- Nigerian banks dropdown
- Account verification

#### 18-19. Reviews & Ratings
- Write review with star rating
- Photo upload for reviews
- Seller review page
- Rating breakdown visualization
- Individual review display

#### 20-21. Profile & Settings
- User profile with stats
- Personal information
- Account settings
- Privacy controls
- Language selection
- Support links

#### 22-24. Admin Dashboard
- Platform statistics
- User management table
- Verification controls
- Product moderation
- Reported products handling

#### 25. Error States
- 404 Not Found page
- Empty states for cart, orders, messages
- Loading skeletons

## 🇳🇬 Nigerian Features

### States & LGAs
- 37 Nigerian states + FCT
- Dynamic LGA selection based on state
- Accurate geographic data

### Currency
- Nigerian Naira (₦) formatting
- Thousands separator
- `formatNaira()` utility function

### Banks
- 23 Nigerian banks supported
- Account verification flow
- BVN integration ready

### Delivery Services
- GIGL (nationwide)
- Sendy (Lagos same-day)
- Pickup option

### Categories
- Electronics 📱
- Fashion 👕
- Home & Living 🏠
- Vehicles 🚗
- Property 🏢
- Beauty 💄
- Sports ⚽
- Other 📦

## 🎨 Design System

### Colors
- **Primary**: #22c55e (Fresh Green)
- **Secondary**: #eab308 (Sunshine Yellow)
- **Success**: #22c55e
- **Warning**: #f97316
- **Error**: #ef4444
- **Info**: #3b82f6
- **Grays**: 10-level scale from #f9fafb to #111827

### Typography
- Font: Inter (via system fonts)
- H1: 32px / Bold
- H2: 24px / Semibold
- H3: 20px / Semibold
- Body: 14px / Regular
- Small: 12px / Regular

### Components
- Primary/Secondary/Outline/Danger buttons
- Input fields with validation states
- Condition badges (New, Like New, Good, Fair)
- Status badges (Active, Processing, Shipped, Delivered)
- Product cards with ratings
- Seller cards with verification
- Order cards with actions

## 🚀 Navigation

### Bottom Navigation
- Home 🏠
- Search 🔍
- Sell ➕
- Messages 💬
- Profile 👤

### Key Routes
- `/` - Homepage
- `/design-system` - Design System showcase
- `/login` - Login
- `/register` - Register
- `/products` - Product listing
- `/products/:id` - Product detail
- `/cart` - Shopping cart
- `/checkout` - Checkout flow
- `/orders` - Order list
- `/messages` - Conversations
- `/seller/dashboard` - Seller dashboard
- `/profile` - User profile
- `/admin/dashboard` - Admin panel

## 📱 Mobile-First Design

- Base width: 375px
- Responsive up to desktop (1440px)
- Touch-friendly tap targets
- Optimized for Nigerian mobile users
- Data-efficient images

## 🔒 Safety Features

- Public meeting recommendations
- Inspection before payment tips
- Verified seller badges
- Platform fee for security
- Report system ready

## 🛠️ Technical Stack

- **Framework**: React 18 with TypeScript
- **Routing**: React Router 7 (Data mode)
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Images**: Unsplash (via MCP tool)
- **Build**: Vite (development)

## 📦 Data Structure

- Products with images, prices, locations
- User profiles (buyer/seller roles)
- Orders with tracking status
- Messages with product context
- Reviews with ratings
- Nigerian geographic data

## 🎯 User Flows

1. **Buying**: Browse → Filter → View Detail → Add to Cart → Checkout → Track Order → Review
2. **Selling**: Register as Seller → Add Product → Manage Listings → Process Orders → Get Paid
3. **Communication**: Browse Product → Contact Seller → Chat → Arrange Meetup

## ✨ Key Features

- Real-time search and filtering
- Multi-image product galleries
- Delivery fee calculation
- Payment method selection (Paystack integration ready)
- Order tracking with status updates
- Seller verification system
- Rating and review system
- Admin moderation tools

---

Built following the complete GreenHub design specification for a trustworthy, modern Nigerian marketplace experience.
