# Ad Boost Payment Flow Architecture

**Document Type:** AI Knowledge Transfer / Flow Documentation
**Target Audience:** Future AI Assitants (Chatbot) and Developers

## Context
This project features a C2C marketplace where sellers can buy subscription plans (Boosts, Banners, Packages) to advertise their listing. This document explains the routing, component interactions, and simulated payment implementation for the **Ad Boost Payment Flow**.

## Flow Overview
1. **Initiation (`src/app/pages/seller/Products.tsx`)**
   - A user clicks the `⋮` menu next to a product and selects "Boost Ad".
   - The user is navigated to the advertisement page while persisting their product ID via search parameters: `/seller/advertise?productId={id}`.
   - Alternatively, a user can navigate straight to `/seller/advertise` without a predetermined product from the Dashboard (`Dashboard.tsx`).

2. **Selecting a Plan (`src/app/pages/seller/Advertise.tsx`)**
   - The user selects a plan (e.g. "Weekly Boost").
   - A short `setTimeout` of `600ms` exists on the `PlanCard` click handler to auto-advance the user to the `Payment Method` selection phase without missing the UI cue. 
   - A "Select Plan" / "Continue to Payment" button inside the PlanCard enforces explicit confirmation.

3. **Processing the Payment (`src/app/pages/seller/Advertise.tsx`)**
   - No real payment gateways (e.g. Paystack / Flutterwave) are integrated yet.
   - The application employs a frontend visual simulation of processing (`isProcessing` state) rendering a centered `Loader2` from `lucide-react` behind a semi-transparent dark backdrop.
   - After a 2000ms delay, the user is navigated to the ad configuration view (`SetupAd.tsx`), inheriting the initial `productId` param payload.

4. **Setup Complete (`src/app/pages/seller/SetupAd.tsx`)**
   - The `SetupAd` component pulls the selected `plan` and `productId` natively from `useSearchParams`.
   - The state `selectedProductId` checks if `productId` exists in the URL array and automatically highlights the chosen product in UI so the user does not have to hunt for it.
   - The user concludes by selecting "Publish Ad" and saving the settings locally in `localStorage`.
