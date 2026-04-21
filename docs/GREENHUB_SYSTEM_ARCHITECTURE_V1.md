# GreenHub System Architecture & Logic Book (V1.0)

## 1. Core Philosophy

GreenHub is a high-performance marketplace designed for trust, scarcity, and data-driven growth.  
The product experience follows an Emerald UI/UX theme: professional, secure, and premium.

## 2. Search & Discovery Engine

- Predictive Search: uses debounced input to query products (prefer optimized queries and scoped selects).
- Dictionary Fallback: if no products match, evaluate Synonym Mapper terms (example: `phone` -> `Electronics`) and suggest categories.
- Waitlist Flow: if search returns zero results, users can select `Request Item`, which inserts into `requested_items`.

## 3. Trust Engine (Reputation)

- Verified Reviews: only buyers with delivered `order_items` can post product reviews.
- Reputation Badges:
  - Product cards and seller surfaces display average ratings (example: `4.8 ⭐`).
  - New/zero-review sellers display `New Seller` to avoid cold-start penalty.
- Top-Rated Filter: global search supports showing only sellers with `rating >= 4.5`.

## 4. Logistics & Financial Logic

- Order Lifecycle: `pending -> processing -> shipped -> delivered`.
- Wallet System: seller Cleared Balance includes delivered items only; payout basis is net earnings (90% of gross line value).
- Payout Rules: minimum threshold is `₦2,000`; payout request creates `pending` record in `payout_requests`.

## 5. Inventory & Scarcity

- Stock Guard:
  - `products.stock_quantity` must remain non-negative at DB level.
  - Checkout flow decrements stock by purchased quantity on successful order creation.
- Scarcity UX:
  - `Only X left!` appears when stock is below 5 and above 0.
  - At stock 0, buy CTA becomes `Sold Out` (disabled) and shows `Notify Me`.

## 6. Demand Loop

- Seller Opportunities: dashboard surfaces top 5 `requested_items` so sellers see unmet demand.
- Pre-fill Logic: `List Now` action passes item via URL query; Add Product pre-fills title from search params.

## 7. Technical Stack

- Frontend: React + Tailwind CSS with glassmorphism accents and Emerald feedback palette.
- Backend/DB: Supabase (PostgreSQL) with Row Level Security (RLS).
- Feedback: centralized Emerald-themed toast notifications for key lifecycle events.

## Why this architecture book matters

This document establishes system-wide invariants so features stay connected:

- Checkout changes must stay inventory-safe.
- Review logic must propagate to trust badges and product cards.
- Admin and finance views must respect the same 90/10 payout logic used in seller workflows.
