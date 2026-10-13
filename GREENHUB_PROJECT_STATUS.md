# GreenHub — Project Status

**Updated:** 2026-10-13
**Repository:** leo9th/GreenHub
**Status:** Active development; not certified production-ready.
**Evidence note:** The repository's README/package manifest were read through GitHub. Detailed milestone statements below are based on Codex reports supplied in the ChatGPT conversation; they have not all been independently verified against the latest pushed code or live Supabase environment. Local Codex changes may not yet be pushed.

## Product direction
A mobile-first, multi-country marketplace with consumer listings, business selling and an integrated logistics network. Prioritize simplicity, trust, secure operations and premium responsive design.

## Stack (repository confirmed)
React 18, TypeScript, Vite, React Router, Tailwind CSS v4, Supabase, MapLibre, Vitest and Playwright dependencies. Check the current package manifest and code for exact integration details.

## Marketplace
- Existing product browsing/search, listing/seller flows, messaging, business profiles, administration and payment-related code are part of the project; do not equate repository presence with tested production readiness.
- Priority UX concern: homepage promotional banners and mobile marketplace are crowded/inconsistent. Improve visual hierarchy, banner legibility, search/filter footprint, product visibility and navigation overlap.
- Codex reported fixing marketplace pagination and UUID handling in messaging during TypeScript cleanup; regression coverage remains to be verified.

## Logistics: intended user experiences
- `/logistics`: customer-first entry to **Send a Package** and **Find Freight & Logistics Providers**, with secondary rider/company registration links.
- `/logistics/rider/register`: independent rider application; no required public business profile.
- `/logistics/register`: logistics-company application.
- `/logistics/rider`: rider operations (online/offline, GPS, nearby requests, negotiation, fulfillment, history).
- `/logistics/dashboard`: company services/coverage, fleet/team, credentials and shipments.
- `/logistics/:slug`: public provider profile with careful verification wording.

## Logistics: reported implementation
- Local delivery request flow: pickup/destination/package details, explicit location consent or manual coordinates (not automatic address geocoding), server-side matching of eligible nearby riders, explicit race-safe acceptance, negotiated price, fulfillment progression, authorized live GPS and vehicle release.
- Matching reportedly uses a 25 km radius, fresh phone GPS (5 minutes), up to five nearby vehicles for discovery, and country-level Realtime revision signals without private payload.
- Independent rider registration reportedly supports review states, document resubmission, vehicle readiness and opt-in GPS.
- Companies reportedly support multiple declared services under one provider and fleet/operator management.
- Public verification should distinguish provider identity review from declared services/coverage. Granular service/country/route approval is not yet fully modeled.
- International freight is provider discovery/declaration, **not** a verified end-to-end freight booking workflow.
- No logistics wallet, withdrawals, payouts, automatic dispatch, reliable ETA, OTP/proof of delivery or automated route optimization should be represented as implemented.

## Latest validation reported by Codex
- 181 TypeScript errors reportedly resolved; last report: **zero TypeScript errors** and `git diff --check` passed.
- Production build was **not confirmed** after cleanup due to Windows memory exhaustion (error 1455).
- Earlier responsive smoke tests at 390px and 1280px used mocked discovery responses; not equivalent to live multi-account tests.
- Authenticated request creation, concurrent two-rider acceptance, real phone GPS, verification approval, negotiation/fulfillment/tracking and regression tests remain unverified in supplied reports.

## Database deployment — verify, do not assume
- `20261002250000_local_delivery_lifecycle_hardening.sql` and `20261002260000_local_delivery_pre_fulfillment_lock.sql`: user reported successful SQL execution.
- `20261002280000_logistics_company_credentials.sql`: **deployment unconfirmed**.
- `20261002290000_logistics_stabilization.sql`: **deployment unconfirmed**.
- Check actual Supabase migration history and read-only diagnostics before applying anything. A passing object-existence diagnostic does not by itself prove migration-history registration.
- Relevant local diagnostics reported: `supabase/sql/diagnostics/logistics_stabilization_deployment_check.sql` and `supabase/sql/diagnostics/logistics_manual_verification.md`. Confirm these files exist on the branch in use.

## Immediate priorities (in order)
1. Confirm whether latest Codex work has been committed/pushed and identify the exact branch/commit.
2. Resolve build memory issue and obtain a passing production build after TypeScript cleanup.
3. Reconcile migrations 280/290 with the target Supabase project; deploy only missing, reviewed migrations in order.
4. Run authenticated customer + two-rider end-to-end tests, including race acceptance, GPS denial/staleness, cancellation, negotiation, fulfillment, vehicle locks/release, history and access control.
5. Complete admin credential review UI and applicant rejection/resubmission flow; verify private storage access.
6. Implement a cohesive premium marketplace banner/mobile UI and logistics visual system without disturbing secure backend workflows.
7. Plan granular country/service/route credentials and approvals as a separate schema milestone.

## Known constraints
- Do not declare the platform production-ready until critical real-world flows pass.
- No live chat sync between ChatGPT and Codex. This document is a handoff record and should be kept current by the implementer.
- On every milestone, append/update verified status, outstanding blockers, validation commands and migrations requiring action.
