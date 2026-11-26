# STATIX: build plan

Turns `PAGES_UI.md` (what each page does) into an order of work. Read that file for page details and `DESIGN.md` for the look. This file only says **what to build, in what order, on what stack**.

Status: draft, 26/11/2026. Items marked **[DECIDE]** need an answer before the step that uses them.

## Where we are

- `index.html` is the landing page: one hand-written file, ~1,550 lines, plain CSS variables, `model-viewer` from a CDN, no build step. Signup, vote and stock are fake.
- `assets/` has photos, art and `.glb` models for **Speaker, Amp, Stand**. **Wire has no assets yet**, but Drop 001 needs all 4 products.
- No backend, no database, no package.json.
- Drop 001 target in the reference: **20/12/2026 20:00 (UTC+7)**. That's about 3.5 weeks away.

## Stack (recommended, [DECIDE] to confirm)

| Need | Pick | Why |
|---|---|---|
| App + API | **Next.js (App Router) + TypeScript** | One codebase for pages, API routes and payment webhooks; SSR helps SEO and `hreflang` |
| Styling | **Plain CSS** with the `:root` tokens from `index.html` moved to `app/globals.css`, plus CSS modules | Keeps the landing's CSS as-is; no Tailwind rewrite |
| Database | **Postgres** (Neon or Supabase) + **Drizzle** | Holds and unit numbers need real transactions and row locks |
| Auth | **Auth.js**: email + password, Google | FR-031 |
| i18n | **next-intl**, `vi` default, `/en` prefix | FR-091, NFR-023 |
| Email | **Resend** (or any SMTP) | Opt-in, verify, reset, order mails |
| Payments | **VNPay** and **MoMo** sandbox first; COD | FR-047–FR-049 |
| Shipping | **GHN** API with a fallback table | FR-046 |
| Bot check | **Cloudflare Turnstile** | FR-054 |
| Live counts | **Polling every 3 s** | Meets "≤ 5 s old" (NFR-004) without websockets |
| Hosting | **Vercel** + managed Postgres; a cron for expiring holds | Payment callbacks need a public HTTPS URL |

[DECIDE] Is this a school project with a required stack (e.g. Java/Spring, .NET, PHP)? If so, swap the rows above; the order of work below stays the same.

## Data model

Follows `STATIX 06 Data Model` in the vault. M0 builds the R1 tables only: account, tier, address, waitlist_entry, invite, product, variant, drop_run, edition, edition_unit, hold, customer_order, order_line, payment, refund, shipment, admin_user, audit_log. Vote, trade-in and credit tables wait for R2/R3.

Rule to get right on day one: **saving an edition pre-creates its N unit rows, and a hold takes the lowest free number with `FOR UPDATE SKIP LOCKED`** (query in 06 §2), with the cap checked in the same transaction. Overselling a numbered run is the one bug this store can't have. Number is allocated at hold time (06's working assumption).

## Milestones

Order follows `PAGES_UI.md`: R1 first, "Should" items last, R2/R3 left out.

| # | Milestone | Pages | Done when |
|---|---|---|---|
| **M0** | Scaffold *(today)* | 0 | Next.js app runs; landing renders at `/` and looks the same as `index.html`; tokens in `globals.css`; shared shell (menu, footer, VI/EN switch, consent banner); DB schema migrated; seed Drop 001 with 4 products |
| **M1** | Catalogue, read only | 2, 3, 5 (no buying), 19 | Shop, product template, drop page with server-synced countdown and live "left" count; landing stock bar and countdown wired to the server |
| **M2** | Accounts | 8 | Register, sign in, Google, verify, reset (enumeration-safe), phone OTP (stub sender first); rate limits |
| **M3** | Waitlist | 1, 7, 17 | Real "Send my signal" with double opt-in; confirm page; invite tokens; preferences page with leave / delete |
| **M4** | Buying | 9, 10, 11, 12 | Cart, holds with timer, checkout, VNPay + MoMo sandbox, COD with OTP, webhook handling, idempotent pay, order email; all checkout error states |
| **M5** | Account area | 13, 14, 15, 16 | Orders and timeline, cancel before ship, invoice PDF, returns with photos, addresses |
| **M6** | Admin | A1–A14 | Order: A1, A3, A4, A5, A8, A2, then the rest |
| **M7** | Launch hardening | 4, 6, 18 | Turnstile, waiting room, support/FAQ, desk system; load test the hold path; policies filled in |

## M0 checklist (today)

1. [DECIDE] Confirm the stack above.
2. `npx create-next-app` in the repo root (TypeScript, App Router, ESLint, no Tailwind, `src/` dir).
3. Move `index.html` into `src/app/page.tsx` mostly as-is: CSS into `globals.css` / a module, the inline script into a client component. Keep `index.html` until the port matches it side by side.
4. Move `assets/` to `public/assets/`.
5. Shared layout: sticky menu (+ Shop, Account/Sign in, Cart count), footer, VI/EN switch, consent banner.
6. Postgres + Drizzle: schema above, first migration, seed script for Drop 001.
7. `.env.example` with every key the stack needs (DB, Auth, Resend, VNPay, MoMo, GHN, Turnstile). Real values never get committed.
8. Commit.

## Open decisions (from `PAGES_UI.md`, plus build ones)

| Decision | Blocks |
|---|---|
| Stack and hosting (above) | M0 |
| Product names: Static One or Statix One (slugs, labels) | M1 |
| Wire: photo, art and `.glb` model | M1 shop and product pages |
| When the unit number is picked: at hold or at payment | M4 checkout copy and the hold query |
| Cap per person (1 per product per drop?) | M4 cart: quantity box or not |
| COD for numbered drops: on, limited or off | M4 checkout and OTP step |
| Deposit / "Reserve a slot" (FR-029): keep or drop | M5 drop page |
| Email sender domain and provider | M3 |
| VNPay / MoMo merchant sandbox accounts | M4 |
| Return window (7 days?) and warranty (12 months?) | M5, policies |
