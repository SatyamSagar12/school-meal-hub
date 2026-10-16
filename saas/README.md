# School Meal Hub — multi-school SaaS

The mid-day meal (PM POSHAN) register from the single-school app in the parent
folder, rebuilt as a subscription product for many government schools. It follows
Docchase's pattern: one tenant per school, server-side sessions, server actions
over services, prepaid yearly billing that locks (never deletes), and an operator
console. It runs on **Cloudflare Workers + D1**.

The original Lovable app in the repository root is untouched.

## What a school gets

- **Students:** add, edit, search, and import/export via Excel. 130 rows import in a few seconds.
- **Attendance**, in two modes:
  - *quick count*: one number per class;
  - *student-wise*: tick each child.
  A class's quick count overrides its student-wise tally, as before.
- **Meal quantities per tier:** primary (1–5) and upper primary (6–8) norms are applied class by class.
- **Daily expenses:** the teacher types only the dal and vegetable prices and any extras. The server works out masala, fuel, total, budget and savings from saved attendance; the browser's figure is only a preview.
- **Reports:** daily, monthly or a custom range, for combined, primary or upper primary, exported as Excel or PDF.
- **Teachers:** up to 5 logins per school. The admin adds a teacher with a temporary password, and the teacher must change it at first sign-in.
- **Activity log**, and meal norms you can edit per school and per class.

## How it maps to Docchase

| Docchase | Here |
|---|---|
| `Firm` tenant, `firmId` on every row | `School` tenant, `schoolId` on every row and in every `where` |
| Postgres + RLS | D1 (SQLite). D1 has no RLS, so scoping happens in the service layer, and bulk writes are `INSERT … SELECT` filtered by school |
| argon2id (native) | PBKDF2-SHA256 through WebCrypto, 100k iterations (the most a Worker allows) |
| HMAC'd session tokens, `requireUser()` / `requireAdmin()` | Same design, with 30-day sessions so teachers aren't signing in every morning |
| `billingState()`, trial → grace → lock, nothing deleted | Same, with one plan: ₹1,499 for 12 months, 30-day trial, 7-day grace |
| PhonePe + manual UPI | Same; manual UPI is the default because it has no gateway fee |
| Postgres rate limiter | D1 rate limiter: one atomic upsert per check |
| `/platform` for the operator | Same: schools, revenue, UPI payments to confirm, extend, suspend |
| nodemailer SMTP | Resend HTTP API (Workers can't open SMTP sockets). Optional |
| Vercel + Neon | Cloudflare Workers via OpenNext, with D1 |

## Run locally

```bash
npm install                 # also runs prisma generate + wrangler types
cp .dev.vars.example .dev.vars   # set the two secrets
npm run db:migrate:local    # creates the local D1 database
npm run preview             # builds the real Worker and serves it on :8787
```

`npm run dev` (plain `next dev`) also works, using the same local D1.

Checks: `npm run typecheck`, `npm run lint`, `npm run verify`.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create school-meal-hub --location apac   # paste the id into wrangler.jsonc
# in wrangler.jsonc "vars": set APP_URL, PLATFORM_ADMIN_EMAILS, UPI_ID, SUPPORT_EMAIL, LEGAL_ENTITY_NAME
openssl rand -base64 32 | npx wrangler secret put SESSION_SECRET
openssl rand -base64 32 | npx wrangler secret put TOKEN_SECRET
npm run deploy              # migrates D1, builds, uploads
```

Then sign up your own school on the live site and make it the operator account:

```bash
npx wrangler d1 execute DB --remote --command \
  "UPDATE schools SET billingExempt = 1 WHERE id = (SELECT schoolId FROM users WHERE email = 'you@example.com')"
```

`/platform` opens only when **both** of these hold:

- the email is listed in `PLATFORM_ADMIN_EMAILS`;
- the school is billing-exempt.

A stranger who signs up with your address therefore gets nothing.

**Optional settings:**

- **Custom domain:** Workers → Settings → Domains.
- **Turnstile on signup:** set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`.
- **Password-reset email:** set `RESEND_API_KEY` and `MAIL_FROM`.
- **Instant PhonePe checkout:** set the `PHONEPE_*` values, and point the PhonePe webhook at `/api/billing/phonepe`.

**Schema changes:** edit `prisma/schema.prisma`, then:

1. `npm run db:migration <name>` writes the next SQL file into `migrations/`.
2. `npm run db:migrate:local` applies it locally.
3. The next `npm run deploy` applies it in production.

## Running cost

The usage below is an estimate for **50 schools**. Pricing is from Cloudflare's published limits (October 2026).

| | 50 schools, estimated | Workers Free | Workers Paid ($5/mo) |
|---|---|---|---|
| Requests | ~2,000/day | 100,000/day | 10M/month included |
| D1 rows read | ~1–2M/day | 5M/day | 25B/month included |
| D1 rows written | ~2k/day with quick counts; ~45k/day if every school marks 300 children one by one | 100k/day | 50M/month included |
| D1 storage | ~10 MB per school per year → ~0.5 GB/yr | 5 GB | 5 GB, then $0.75/GB-month |
| CPU per request | sign-in ~40 ms, pages ~10–30 ms | **10 ms** | 30 s |

**Recommendation:**

- **Start on the free plan.** It costs ₹0 for a pilot.
- **Before charging money, move to Workers Paid** ($5 a month, about ₹450–520 including GST). The free plan's 10 ms CPU cap is the one limit this app will hit, on sign-in and on server rendering. Requests that go over it intermittently fail with error 1102.
- **Data volume will not drive cost.** All the D1 numbers stay far inside even the free allowances.

**Yearly, at 50 schools × ₹1,499 = ₹74,950 revenue:**

| | ₹ / year |
|---|---|
| Workers Paid (includes D1) | ~₹5,500–6,200 |
| Domain (.in), optional | ~₹700–1,000 |
| Email (Resend free tier) | 0 |
| Payment fees, manual UPI | 0 |
| Payment fees, PhonePe/Razorpay instead | ~₹1,750 (≈2% + GST) |
| **Total** | **~₹6,500–9,000 (≈9–12% of revenue)** |
