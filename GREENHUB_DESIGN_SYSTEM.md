# GreenHub — Design System and UX Standards

**Updated:** 2026-10-13
**Purpose:** Consistent, premium, accessible mobile-first marketplace and logistics experiences. This is design direction, not a claim that every screen already conforms.

## Brand and visual principles
- Preserve existing GreenHub tokens/components when they exist; do not silently replace established branding.
- Repository's existing `GREENHUB.md` documents fresh green `#22C55E` and yellow `#EAB308`. These are existing reference colors, not a mandate to use neon green everywhere.
- Suggested UI foundation (validate contrast and harmonize with actual tokens): deep green `#087F5B` for strong actions, ink `#0F172A`, muted text `#475569`, surface `#FFFFFF`, soft background `#F6F8F7`, border `#E2E8E7`. Use yellow sparingly for meaningful accents, never as universal status.
- Prefer editorial clarity over clutter: restrained shadows, purposeful imagery, readable typography, consistent radii, generous but economical spacing.
- Use accessible contrast (WCAG AA targets), visible keyboard focus, semantic labels, touch targets around 44px, and reduced-motion support.

## Layout and responsive behavior
- Design mobile first at 320, 375, 390 and 430px; also test tablet and 1280–1440px desktop.
- Avoid horizontal overflow, overlapping fixed bars, clipped modals and forms hidden by keyboard/safe areas.
- Mobile: compact header, obvious primary task, one consistent bottom navigation where appropriate; never stack competing floating support widgets over product cards or action buttons.
- Desktop: appropriate max-width containers, intentional grid density and navigation; do not simply enlarge mobile cards.
- Use skeletons, meaningful empty/error/retry states, permission-denied and offline states, and no fabricated content.

## Marketplace home and banners — high priority
- Order: compact header → prominent product search → compact promotional carousel → category shortcuts → visible product listings; advanced filters should not monopolize first screen.
- Search, location and sort should feel cohesive, not like multiple oversized stacked toolbars.
- Banner slides: consistent aspect ratio/height; strong short headline; concise supporting text; one working CTA; intentional image focal point; reliable contrast/overlay; no essential text baked into images.
- Keep mobile banners compact; avoid text clipping and layout jumps. Use responsive art direction, image loading optimization, keyboard-accessible controls, reduced-motion behavior and sensible autoplay pause.
- Never invent promotional discounts, prices or links. Use approved campaign content and real destinations.
- Product cards: stable image ratio, readable title/price, trustworthy seller/location context where available, favorite action, consistent skeleton and two-column mobile grid when width permits.

## Logistics: shared design language
- Customer home `/logistics`: two dominant choices, **Send a Package** and **Find Freight & Logistics Providers**. Rider/company onboarding links secondary but visible.
- Customer booking: pickup → destination → package → location confirmation → request; explain GPS opt-in and manual coordinate limitations. Do not pretend typed addresses are geocoded.
- Rider onboarding: personal, not corporate; short steps and status clarity (Draft, Submitted, Under Review, Action Required, Approved, Suspended); rejection correction and next action.
- Rider workspace: clear Go Online/Offline, GPS freshness, vehicle readiness, nearby request cards, explicit acceptance, negotiation, active fulfillment timeline and history. “Agreed delivery amounts” must not be mislabeled as paid earnings.
- Company onboarding: Company → Services → Coverage → Tracking → Credentials → Review; support draft save and multiple services. Collect essential identity early and detailed permits at activation as policy allows.
- Company dashboard: Overview; Services & Coverage; Fleet & Team; Documents & Verification; Deliveries & Shipments. Use useful statuses, responsive tables/cards and clear next actions.
- Public provider page: company identity, declared services/coverage and honest verification scope. Do not imply approval of every service/route from one provider badge.
- Live tracking: distinguish fresh, stale and unavailable GPS. No fake ETA or automatic arrival claims.

## Reusable UI patterns
- Buttons: primary, secondary, quiet, destructive; meaningful disabled/loading states; one clear primary action per view.
- Forms: persistent labels, inline validation, logical grouping, save progress where supported; no unexplained technical IDs or internal organization terminology.
- Badges: precise statuses, accessible text, not color alone. “Identity reviewed” differs from “Service approved”.
- Lists/tables: prioritize task-critical information; use responsive cards on narrow screens instead of horizontal scroll where feasible.
- Maps: MapLibre, explicit location consent, graceful permission-denied fallback, safe location precision and no public raw GPS.
- Motion: subtle and functional, never distract from the booking or purchase action.

## Quality gate for UI changes
1. Review real screenshots or browser views at 320/375/390/430/1280px.
2. Check top-of-page hierarchy, banner cropping, search density, navigation collision, forms and primary actions.
3. Test keyboard, focus, reduced motion, loading/empty/error states, long text and slow network behavior.
4. Verify every CTA is connected to a real implemented route/action.
5. Run TypeScript, build, diff check and relevant UI tests; document anything not executed.
6. Preserve existing Supabase/RLS/RPC behavior; UI polish must not bypass verification or location privacy.

## Design priorities
1. Premium marketplace banners and mobile home.
2. Cohesive customer local-delivery booking.
3. Independent rider onboarding and workspace.
4. Company registration, fleet dashboard and verification.
5. Public logistics provider profiles and shared detail screens.
