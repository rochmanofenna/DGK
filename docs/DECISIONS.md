# Decisions log

Chronological record of non-obvious calls. One line per decision, one line per
why. Append, don't rewrite — this is a trail, not a spec. When a decision here
contradicts the code, the code is the current truth and a new entry should
replace it (cite the old one's date).

---

## Dev test accounts

⚠ **Dev only. Rotate before any real user or demo touches this system.**

| Email              | Password                    | Role            |
|--------------------|-----------------------------|-----------------|
| `ops@dgk.dev`      | `ops-dev-pw-change-me`      | `OPS_MANAGER`   |
| `finance@dgk.dev`  | `finance-dev-pw-change-me`  | `FINANCE_ADMIN` |

Seeded by `prisma/seed.ts`, bcrypt-hashed at seed time. To rotate: edit the
`PASSWORDS` constant in the seed file and re-run `npx prisma db seed` — the
upsert-by-email will refresh the stored hashes in place.

---

## 2026-04-16 — MVP scaffold

- **Next.js 16 / React 19 / Tailwind 4 / Prisma 7 (keeping `create-next-app` latest, not spec-era majors).** Migration pain later > training-data gap now. `AGENTS.md` + CLAUDE.md in repo flag that Next 16 has breaking changes; mitigation is to read `node_modules/next/dist/docs/` before writing any Next-specific file.
- **NextAuth v5 beta, not v4 stable.** v4 needs wrapper hacks in App Router; v5 is App-Router-native by design. Beta is production-grade — flag any rough edge per-issue rather than preemptively downgrading.
- **Supabase for Postgres + Storage (not Neon + separate S3).** POD photos, invoice PDFs, and permission docs all need file storage anyway; one dashboard saves ~1 hour of S3 plumbing and keeps ops simpler.
- **NextAuth for auth (not Supabase Auth).** Auth config stays in our repo rather than Supabase dashboard — easier to reason about RBAC, session shape, and future providers.
- **English-only UI for MVP; Bahasa Indonesia = Phase 2.** Resolves the SPEC §6.1 (Bahasa primary) vs §8 (English for prototype) contradiction in favor of §8. Translate once UX is settled.
- **DGK-only auth for MVP; no vendor or customer portals.** Per SPEC §8. DGK staff updates vendor status manually. Schema still models multi-org so Phase 2 portals don't require data migration.
- **`DeliveryOrder.status` is the source of truth; `Order.status` is kept in sync via application logic after every DO status change.** Two parallel state machines would drift; DO is authoritative. Keeping `Order.status` stored (vs computed) trades a small drift risk for cheap list filtering. `TODO(phase-2):` migrate to a computed getter once multi-DO-per-order is real.
- **PPN effective rate 1.1% for freight invoices (not headline 11%).** PMK-71/PMK.03/2022 DPP Nilai Lain makes the taxable base 10% of gross for freight services; effective rate = 11% × 10% = 1.1%. Named constant in `lib/tax.ts` with a source comment so nobody "corrects" it.
- **IDR stored as `Int` (whole rupiah, no decimals).** Daily business has no sub-rupiah units; `Int` avoids float rounding on invoice totals. Formatted at display time via `Intl.NumberFormat('id-ID')`.
- **`customer_price_idr` is a manual input at order creation for MVP.** SPEC open question #1 (flat per-customer rate vs vendor cost + %) is unresolved; manual input works under either pricing model and defers the decision without blocking invoicing.
- **`Region` enum for rate card lookup (not free-form addresses).** Rate card is `origin_region × destination_region × truck_type`; free-form address → region would need fuzzy matching we don't have time for. Enum covers Transcoll's 11 current routes; expand when vendor #2 arrives.
- **`TruckType` enum hardcoded to Transcoll's two tiers (`CDEL_2T`, `TRONTON_20T`).** Extensible per SPEC §4; when vendor #2 adds a new truck class, we add an enum value and migrate.
- **Invoice numbering is internal-only for MVP; real Faktur Pajak IDs deferred.** SPEC open question #4 (DJP-regulated format) is unresolved. Simple sequential numbering until Dylan confirms the format.
- **IDs: `String @id @default(cuid())`.** URL-friendly, sortable, non-sequential. Standard Prisma convention.

## 2026-04-16 — schema review (pre-migration)

- **`User.organizationId` is required; DGK Organization row seeded from day one.** Supersedes the earlier "nullable for MVP, skip the implicit DGK org" schema TODO. That was false-economy tech debt — seeding one row in the seed script removes both a nullability check across every auth query and a future non-null migration.
- **Extra-point and overnight fees live on `RateCard`, not `RateCardEntry`.** Re-reading the Transcoll PDF (SPEC §11 Notes): these are card-level policy (and only apply to CDEL trucks), not per-route. Putting them on entries would duplicate the same Rp 200,000 / Rp 300,000 across every row. When a future vendor has per-route variants we move them down.
- **`Customer.creditTermsDays` is required with no default.** 30 days was a guess. **Open question for Dylan:** what credit terms does DGK actually extend to customers — flat across all, per-customer agreement, or tied to the invoice?
- **Internal numbering: `ORD-YYYY-NNNNN`, `DO-YYYY-NNNNN`, `INV-YYYY-NNNNN` with per-type yearly counters.** Simple references for MVP. Faktur Pajak DJP-regulated numbers (SPEC open question #4) are deferred until Dylan confirms the format — when they arrive, they'll coexist with the internal `invoiceNumber`. `lib/numbering.ts` helper gets added when we build the first minting site (Order creation).
- **All models get `createdAt` / `updatedAt`.** Consistent auditability even on lookup tables — "when was this rate card entry last edited?" is a real question in pricing disputes, and the column is cheap.
- **Recency indexes: `@@index([createdAt])` on Order and DeliveryOrder.** Dashboards always want recency-ordered queries; adding after real data is annoying.

## 2026-04-16 — Supabase wiring

- **Database hosted on Supabase (Singapore / `ap-southeast-1`).** Project ref `omdyrdezhgclhntnrgps`.
- **Pooler mode: Session (port 5432) for MVP, both `DATABASE_URL` and `DIRECT_URL`.** Session pooler is IPv4-compatible and safe for runtime *and* migrations. At Vercel deploy time, swap runtime `DATABASE_URL` to the Transaction pooler (port 6543) for better serverless cold-start behavior; keep `DIRECT_URL` on Session for migrations.
- **`DIRECT_URL` lives in `.env` but not in `prisma.config.ts` (Prisma 7 change).** Prisma 7 dropped the `directUrl` field from the config's `datasource` block — the migration/runtime split is now expressed by passing a driver adapter to the `PrismaClient` constructor, not in the CLI config. For MVP both URLs are identical (Session pooler, port 5432) and only `DATABASE_URL` is wired to Prisma. At Vercel deploy we'll add a driver adapter pointing at the Transaction pooler (port 6543) for runtime and keep the Session pooler for migrations.
- **Publishable-key-only client pattern.** The app uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for all Supabase client calls; no service role key is wired. Admin operations (bucket creation, RLS policies) are done via the Supabase dashboard, not application code.
- **Supabase is Storage-only; auth stays on NextAuth v5.** `lib/supabase.ts` wires the `@supabase/ssr` cookie plumbing regardless so adopting Supabase Auth later would be a small change rather than a rewrite.
- **Storage bucket `dgk-erp` is created manually in the Supabase dashboard** (no service role key means we can't provision it programmatically). Single bucket with folder namespaces: `pod/<deliveryOrderId>/<photo>`, `invoice/<invoiceId>.pdf`, `permission/<deliveryOrderId>.pdf`.
- **Number generation format: `ORD-YYYY-NNNNN`, `DO-YYYY-NNNNN`, `INV-YYYY-NNNNN`** per-type yearly counters. Stubbed in `lib/numbering.ts`; real DB-backed implementation arrives with the first minting site (Order creation). Faktur Pajak numbers (SPEC open question #4) coexist once DJP format is confirmed.

## 2026-04-16 — seed + Prisma 7 runtime wiring

- **Seed command lives in `prisma.config.ts` under `migrations.seed`, not `package.json`.** Prisma 7 deprecated the `package.json > prisma > seed` path. Current value: `"tsx prisma/seed.ts"`. `npx prisma db seed` reads from the config file.
- **`PrismaClient` requires a driver adapter at runtime; using `@prisma/adapter-pg` against the Session pooler URL.** Prisma 7 no longer auto-configures a connection from `DATABASE_URL` — `new PrismaClient()` without options throws `PrismaClientInitializationError`. Seed and the future `lib/db.ts` both construct `new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`. At Vercel deploy we swap the adapter's connection string to the Transaction pooler (port 6543) without schema changes.
- **Seed data uses stable `seed_*` IDs instead of cuid defaults.** Every seeded row is `prisma.x.upsert({ where: { id: "seed_…" } })`, so re-runs update in place rather than creating duplicates.
- **DGK Organization seeded with plausible Jakarta placeholder fields** (not zeros) so invoice PDFs render realistically in dev. Every placeholder field is tagged `[DEV PLACEHOLDER]` in `prisma/seed.ts` for grep-and-replace when Dylan provides real values — DGK address, NPWP, contact person, phone, bank account, plus the customer NPWPs / names / addresses.
- **Dev passwords are distinct per user** (`ops-dev-pw-change-me`, `finance-dev-pw-change-me`) and bcrypt-hashed at seed time. Distinct values make wrong-role session bugs visible — identical passwords would mask a login that didn't actually switch role.

## 2026-04-16 — Module 6: vendor assignment + DO creation

- **Rate-card rollover rule.** When a vendor has multiple active rate cards covering the same (origin, destination, truck) tuple, pick the entry from the rate card with the latest `effectiveDate`. Rationale: rollover scenario — a new card effective today supersedes an older card that also happens to still be active (no expiry set yet). Implementation: `ORDER BY rateCard.effectiveDate DESC` + in-memory dedupe keyed by `vendorId` (first-seen wins). Lives in `lib/rate-cards.ts`.
- **`rateCardEntryId` is the assignment action's payload, not `vendorId`.** Passing the entry ID pins the exact price the user saw on screen; if the rate card changes between dialog render and confirm, the server re-check catches it and returns a clean error instead of silently charging a different price. Never switch the action to look up the entry from `vendorId` without understanding this invariant.
- **`DeliveryOrder.vendorPriceIDR` is a frozen snapshot, never a FK lookup.** Copied from `RateCardEntry.priceIDR` at assignment time inside the creation transaction. Rate-card edits must not mutate historical DOs. A "helpful" refactor that replaces this column with a join through `rateCardEntryId → priceIDR` would silently reprice every past delivery on the next rate-card edit.
- **DO creation + `Order.status → ASSIGNED` run in a single `db.$transaction`.** Either both commit or neither does; no half-assigned orders with a DO but `SUBMITTED` status, or an `ASSIGNED` order without a DO. The status precondition (`order.status === SUBMITTED`) is validated by a server-side read *before* the transaction opens; concurrent cancel-while-assign is a low-probability race the check tolerates (the update inside the tx would succeed into a CANCELLED order — acceptable because cancel is a human operation at DGK's scale, and if it matters we'll add optimistic-locking via `updateMany { where: { status: SUBMITTED } }`).
- **Dialog error UX: stay open on failure, close on success.** When `createDeliveryOrderAction` returns a validation error (order already assigned, rate card no longer covers this route, rate card expired), the dialog does *not* auto-close. Auto-closing drops the user back on a stale order-detail page with no indication why nothing happened. Error renders inline in the dialog; the user dismisses manually.

## 2026-04-16 — Module 7: DO detail, checklist, POD upload, POD verification

- **Amended Supabase key posture.** Earlier rule ("publishable key only") is superseded. New rule: **publishable key for ALL client code; service role key for server-only admin operations (file uploads, bucket writes).** The service role key MUST NEVER be prefixed `NEXT_PUBLIC_*` and MUST NEVER enter a Client Component's module graph. Violations are security bugs. `lib/supabase-admin.ts` uses `import "server-only"` so the module graph rule is enforced by the build, not convention.
- **`TODO(deploy):` `SUPABASE_SERVICE_ROLE_KEY` must be set in Vercel's environment variables before first deploy.** Production has no local `.env`; first POD upload on an unconfigured Vercel project 500s without a clear error trail. Add alongside `DATABASE_URL`, `AUTH_SECRET`, and the public Supabase keys when the Vercel project is wired.
- **Supabase Storage RLS: public-read bucket, deny-write by default.** `dgk-erp` bucket toggled `Public bucket = ON` (grants SELECT to anon + authenticated). **No INSERT/UPDATE/DELETE policies defined** — absence of a policy = deny-by-default for anon and authenticated. The service role key bypasses RLS entirely (that's its purpose), so server actions can still write. Public-read is fine because photo URLs end up in invoice PDFs anyway; uploads are app-mediated via the service role.
- **POD upload path is server-generated, never client-supplied.** Path shape: `pod-photos/{deliveryOrderId}/{crypto.randomUUID()}.{ext}`. Extension derived from the **validated MIME** (not the filename), so `foo.exe.jpg` and `../../whatever.jpg` can't escape the bucket folder. Filename never touches the stored path.
- **File validation: authoritative on the server.** Client-side checks (`accept="image/*"`, size check in `onChange`) are UX only and can be bypassed. Server re-validates count ≤ 5, size ≤ 2 MiB, MIME in allow-list before handing the buffer to Supabase. Magic-byte sniffing (e.g. `file-type`) is Phase-2 hardening — Content-Type + size + server-generated path covers the high-likelihood attacks.
- **DO state machine lives in `lib/do-state-machine.ts` — single source for both render and server.** Render reads `STATUS_BUTTONS[currentStatus]` to decide which buttons to show; server action calls `canTransition(current, requested)` before flipping. If the rules drift between the two, one is wrong. Keep both reading from this file.
- **`DISPATCHED → DELIVERED` is intentionally NOT a raw user-button transition.** DELIVERED is only reachable through POD verification (`verifyPodAction`), which requires a POD on file and flips DO + parent Order atomically. Prevents "marked delivered without proof."
- **POD re-upload is allowed while unverified, locked after verification.** Vendor may have uploaded the wrong photos first time; the action `upsert`s by `deliveryOrderId` while `verifiedAt IS NULL`. Once verified, further uploads are rejected.
- **POD verification transaction flips three rows atomically:** `ProofOfDelivery.verifiedByDgkId + verifiedAt`, `DeliveryOrder.status = DELIVERED + deliveredAt = pod.deliveredAt`, `Order.status = DELIVERED`. `TODO(phase-2):` when an Order has multiple DOs, only flip Order.status when ALL sibling DOs are DELIVERED. MVP assumes 1:1.
- **`next.config.ts > experimental.serverActions.bodySizeLimit = "15mb"`.** Default is 1 MB; 5 photos × 2 MiB needs headroom for multipart overhead. Ship the bump with Module 7 rather than debugging a cryptic 413 on first upload.
- **`"use server"` files can only export async functions (Next 16 strict, enforced at runtime).** `export const X = {...}` or `export interface X` with a runtime value throws *"A 'use server' file can only export async functions, found object."* Types (pure interfaces, type aliases) are erased and fine; concrete values must live in a sibling non-directive file. `PodUploadState` + `INITIAL_POD_UPLOAD_STATE` live in `schemas.ts` for exactly this reason. Build + `tsc` DO NOT catch this — it surfaces only when the module is requested at runtime.

- **Next 16 renamed `middleware.ts` → `proxy.ts`** (per `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`). Proxy is **Node runtime only** in 16.x; `edge` isn't supported and docs promise a future minor will reopen it. File and function are both called `proxy`; config flags followed (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). Discovered while reading the Next 16 docs per the AGENTS.md warning — exactly the payoff that warning was pointing at.
- **Kept the `auth.config.ts` / `auth.ts` edge-safe split even though proxy is Node today.** No Prisma or bcryptjs in `auth.config.ts` means if edge returns for proxy in a later Next minor (or if we add a separate edge route that needs auth), the split is already in place. Cost is zero.
- **NextAuth v5 beta.31 shape confirmed** from `node_modules/next-auth/index.d.ts`: `const { handlers, auth, signIn, signOut } = NextAuth(config)`; Credentials provider at `next-auth/providers/credentials`; `AuthError` and `CredentialsSignin` exported from the `next-auth` root.
- **`Credentials.authorize()` returns `null` on any failure** rather than throwing. Throwing a non-`CredentialsSignin` error crashes the callback route and the login silently fails — `null` is the documented "wrong credentials" signal that produces a clean re-render of the form with `error=CredentialsSignin`.
- **`callbackUrl` is sanitized** on the login page: only accept paths starting with `/` and not `//` (which would be protocol-relative → open-redirect). Anything else falls through to `/dashboard`.
- **Belt-and-suspenders auth:** proxy blocks unauthenticated requests at the matcher; `app/(dgk)/layout.tsx` re-checks in the Server Component render as backstop *and* enforces the role whitelist (`ADMIN | OPS_MANAGER | FINANCE_ADMIN`). Proxy deliberately doesn't do the role check — that policy lives next to the route group it protects.
- **`AUTH_SECRET` generated locally via `openssl rand -base64 32`** and written to `.env`. `.env.example` ships a placeholder string; every dev rotates their own value. Missing `AUTH_SECRET` in prod makes NextAuth fail to persist any session.
- **`lib/db.ts` uses the same `@prisma/adapter-pg` wiring as `prisma/seed.ts`,** cached on `globalThis.__prisma__` in dev so Next's module reloading doesn't exhaust the pooler.
