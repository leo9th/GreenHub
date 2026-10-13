# GreenHub — Agent Instructions

Applies to this repository. Read this file together with `GREENHUB_PROJECT_STATUS.md` and `GREENHUB_DESIGN_SYSTEM.md` before substantial work.

## Mission
GreenHub is a mobile-first marketplace with integrated logistics, supporting individual buyers/sellers, businesses, independent riders, logistics companies and administrators. Make the product simple to use, secure, accessible and extensible across configured countries. Do not mistake a declared or designed feature for a verified production capability.

## Technical foundation
- React 18, Vite, TypeScript, React Router and Tailwind CSS v4 (see `package.json` for actual versions).
- Supabase Auth, Postgres, RLS, Storage and server-side RPCs; MapLibre for maps; existing payment integrations where already implemented.
- Inspect existing routes, components, data-access layers, schema and migrations before making changes. Reuse existing primitives and RPCs; do not create parallel systems.
- Respect existing multi-country configuration and currency handling; avoid hardcoding Nigeria-only assumptions into shared workflows.

## Workflow
1. Read the relevant code and current documentation; state assumptions and the smallest coherent implementation plan.
2. Work on one scoped milestone at a time. Preserve existing user journeys and backwards compatibility.
3. Implement actual functioning controls, not decorative buttons or invented data. Distinguish mock tests from authenticated/live tests.
4. Keep mobile (320–430px), tablet and desktop usable. Follow `GREENHUB_DESIGN_SYSTEM.md`.
5. Prefer explicit types; never silence errors with `any`, `@ts-ignore`, or relaxed compiler settings.
6. Run `npx tsc --noEmit`, `npm run build`, `git diff --check`, and relevant tests when feasible. Report failures and environmental blockers honestly.
7. Report files changed, tests executed, tests not executed, security implications, and any required SQL.
8. Update `GREENHUB_PROJECT_STATUS.md` after meaningful verified milestones; do not claim a migration deployed merely because a local file exists.

## Database and security
- Treat RLS and server-side authorization as mandatory. Never expose private GPS, identity documents, private customer pickup coordinates, or unrestricted business data.
- All privileged verification, matching, acceptance, negotiation, fulfillment and vehicle release decisions remain authoritative on the server.
- Never modify an already-deployed migration in place. New schema changes require forward-only migrations and explicit deployment instructions.
- Do not apply migrations or mark them applied without verifying project scope and migration history.
- Provider identity verification does not imply approval for every service, route or jurisdiction.
- Independent riders must not be required to create a public business profile; internal authorization relationships should remain invisible to them.

## Product boundaries
- Customer logistics: local package request and provider discovery are distinct from international freight booking.
- Rider: registration, admin verification, GPS opt-in, nearby matching, explicit acceptance, negotiation, fulfillment and history; no invented wallet or payout claims.
- Company: one provider profile can declare multiple services and manage vehicles/operators, with accurate approval scope.
- Do not advertise live ETA, automatic dispatch, international freight execution, proof of delivery, payment settlement or other capabilities unless actually implemented and tested.
- No self-verification, automatic rider assignment or unauthorized status/vehicle reassignment.

## Collaboration
- Codex desktop and ChatGPT do not automatically synchronize chat history. This repository's documents are shared references only after committed/pushed.
- Prefer copy-paste-ready task reports with: implemented, files changed, tests run, failures, database action, manual tests, next milestone.
- Keep secrets, personal documents, .env values and tokens out of Git.
