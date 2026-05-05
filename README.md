# GreenHub

GreenHub is Nigeria's hybrid marketplace where people and businesses buy and sell electronics, fashion, and everyday goods—peer-to-peer and from shops—in one trusted place.

*Shop. Sell. Grow on GreenHub.*

## Running locally

1. Copy environment template and configure Supabase (required for API/auth):

   ```bash
   cp .env.example .env
   ```

   Edit `.env`: set **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** from your Supabase project (**Dashboard → Project Settings → API**). Optionally add **`VITE_PAYSTACK_PUBLIC_KEY`** for card/checkout and seller boost flows, and **`VITE_SITE_URL`** if your deployed URL must differ from `http://localhost` (password reset / OAuth redirects). See comments in **`.env.example`** for all `VITE_*` options.

2. **Apply database migrations** to the Supabase project your app uses (so tables/columns match checkout RPCs — e.g. `orders.total_amount`). From the repo root, with the CLI linked to that project: `npx supabase db push`. Alternatively, run any pending `.sql` files under **`supabase/migrations/`** in the Supabase **SQL Editor** (or append from **`supabase/all_migrations_bundle.sql`** if your workflow uses a single bundle).

3. Install dependencies and start the development server:

   ```bash
   npm i
   npm run dev
   ```
