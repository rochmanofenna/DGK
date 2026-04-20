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

## Pre-deploy placeholder replacement

Every field currently tagged `[DEV PLACEHOLDER]` in `prisma/seed.ts` must be
replaced with real Dylan-supplied values before DGK touches real data.
Grep `[DEV PLACEHOLDER]` to find them; this list is the same set,
grouped by entity for a demo-day / deploy-day punch list.

**DGK Organization** (`seed_dgk_org`)
- [ ] `address` — currently `Jl. Jenderal Sudirman No. 1, Jakarta Pusat 10220` → replace with real HQ address
- [ ] `taxId` — currently `01.234.567.8-012.000` → replace with DGK's real NPWP
- [ ] `contactPerson` — currently `"Dylan"` → replace with real point of contact name
- [ ] `phone` — currently `+62 21 5555 0100` → replace with real number
- [ ] `bankName` / `bankAccount` — currently `BCA` / `012 3456789` → replace with the real account DGK uses for customer payments (shows on every customer invoice PDF)

**Transcoll Organization** (`seed_transcoll_org`)
- [ ] `address` — currently `Sentul / Cileungsi / Narogong area, West Java` → SPEC §11 didn't provide a street address; request from Transcoll
- [ ] `taxId` — currently `02.345.678.9-023.000` fabricated → request NPWP from Transcoll
- (other fields come from SPEC §11 verbatim; no change needed)

**Customer Organizations** (Berkah Pangan, Sumber Rasa, Arumi Boga)
- [ ] All three are fictional seed data. Replace with the real customer roster Dylan provides. Each needs: `name`, real NPWP (`taxId`), real `address`, real `contactPerson`, real `phone`, and a real business email.
- [ ] `creditTermsDays` — currently `30 / 30 / 45` (guesses). Confirm per customer with Dylan.

**Users**
- [ ] `ops@dgk.dev` / `ops-dev-pw-change-me` — rotate password, optionally change email to a real DGK staff address
- [ ] `finance@dgk.dev` / `finance-dev-pw-change-me` — same rotation
- [ ] User names `Rina Pratama` and `Bayu Santoso` are placeholders → replace with real names
- [ ] Phone numbers `+62 811 1000 001/002` are placeholders

**Not placeholders — rules that carry into production**
- Rate card (Transcoll): prices + extra-point/overnight fees come from the real rate card PDF (SPEC §11). Don't replace unless Transcoll issues a new card.
- `paymentTermsDays: 14` for Transcoll — per contract.
- `PPN_FREIGHT_RATE = 0.011` in `lib/tax.ts` — Indonesian tax rule, not a placeholder.

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
- **Supabase Storage RLS: public-read bucket, deny-write by default.** Bucket `kampono_bucket` (in Supabase project `dgk-erp`, `jakarta_trade_connect` org) toggled `Public bucket = ON` (grants SELECT to anon + authenticated). **No INSERT/UPDATE/DELETE policies defined** — absence of a policy = deny-by-default for anon and authenticated. The service role key bypasses RLS entirely (that's its purpose), so server actions can still write. Public-read is fine because photo URLs end up in invoice PDFs anyway; uploads are app-mediated via the service role. The bucket name is a single constant (`POD_BUCKET` in `lib/supabase-admin.ts`) — change in one place if we rename.
- **POD upload path is server-generated, never client-supplied.** Path shape: `pod-photos/{deliveryOrderId}/{crypto.randomUUID()}.{ext}`. Extension derived from the **validated MIME** (not the filename), so `foo.exe.jpg` and `../../whatever.jpg` can't escape the bucket folder. Filename never touches the stored path.
- **File validation: authoritative on the server.** Client-side checks (`accept="image/*"`, size check in `onChange`) are UX only and can be bypassed. Server re-validates count ≤ 5, size ≤ 2 MiB, MIME in allow-list before handing the buffer to Supabase. Magic-byte sniffing (e.g. `file-type`) is Phase-2 hardening — Content-Type + size + server-generated path covers the high-likelihood attacks.
- **DO state machine lives in `lib/do-state-machine.ts` — single source for both render and server, and now role-aware.** Each transition carries an `allowedRoles` list (e.g. `PENDING → ACKNOWLEDGED` is vendor-driven with DGK OPS/ADMIN as override; `* → CANCELLED` is DGK-only). Render reads `transitionsForRole(currentStatus, role)` to pick buttons; server action calls `canTransitionAsRole(current, requested, role)` before flipping. If render and server drift, one is wrong — this file is the source of truth. Audit trail (`actorUserId` per transition) is a phase-3 follow-up; currently we know who transitioned only by the last-mutator log, not per-row.
- **`DISPATCHED → DELIVERED` is intentionally NOT a raw user-button transition.** DELIVERED is only reachable through POD verification (`verifyPodAction`), which requires a POD on file and flips DO + parent Order atomically. Prevents "marked delivered without proof."
- **POD re-upload is allowed while unverified, locked after verification.** Vendor may have uploaded the wrong photos first time; the action `upsert`s by `deliveryOrderId` while `verifiedAt IS NULL`. Once verified, further uploads are rejected.
- **POD verification transaction flips three rows atomically:** `ProofOfDelivery.verifiedByDgkId + verifiedAt`, `DeliveryOrder.status = DELIVERED + deliveredAt = pod.deliveredAt`, `Order.status = DELIVERED`. `TODO(phase-2):` when an Order has multiple DOs, only flip Order.status when ALL sibling DOs are DELIVERED. MVP assumes 1:1.
- **`next.config.ts > experimental.serverActions.bodySizeLimit = "15mb"`.** Default is 1 MB; 5 photos × 2 MiB needs headroom for multipart overhead. Ship the bump with Module 7 rather than debugging a cryptic 413 on first upload.
- **`"use server"` files can only export async functions (Next 16 strict, enforced at runtime).** `export const X = {...}` or `export interface X` with a runtime value throws *"A 'use server' file can only export async functions, found object."* Types (pure interfaces, type aliases) are erased and fine; concrete values must live in a sibling non-directive file. `PodUploadState` + `INITIAL_POD_UPLOAD_STATE` live in `schemas.ts` for exactly this reason. Build + `tsc` DO NOT catch this — it surfaces only when the module is requested at runtime.

## 2026-04-16 — Module 8: invoice generation + PDF rendering

- **Amended publishable-key rule — second reinforcement.** `SUPABASE_SERVICE_ROLE_KEY` is now used by TWO server-only surfaces: POD photo uploads (Module 7) and invoice PDF uploads (this module). Same guarantee applies: the key must never be prefixed `NEXT_PUBLIC_*` and must never enter a Client Component's module graph. `lib/supabase-admin.ts` still has `import "server-only"` at the top and is the only file that instantiates the admin client.
- **`TODO(deploy):` unchanged — `SUPABASE_SERVICE_ROLE_KEY` still needs to land in Vercel env before first deploy.** Same key, now covers invoice PDFs too. First Module 8 invoice generation on an unconfigured Vercel project 500s without a clear trail.
- **Both invoice entry points live on `/deliveries/[id]` for MVP.** Vendor invoice and customer invoice buttons sit side-by-side in the new `Invoicing` card; each disables itself once its type exists. `TODO(phase-2):` when Orders span multiple DOs, the customer invoice moves to `/orders/[id]` (order-level, aggregates line items across DOs) — schema already supports the split, only the UI surface relocates.
- **`createInvoiceAction` is the first three-way transactional write in the system** (after Module 6's two-way DO+Order flip). Inside `db.$transaction`: (a) insert Invoice row, (b) check whether both `VENDOR_TO_DGK` and `DGK_TO_CUSTOMER` now exist for this DO's parent Order, (c) if yes, flip `Order.status → INVOICED`. `TODO(phase-2):` for multi-DO orders, the check must widen to "all sibling DOs have both invoices."
- **PDF rendering = `renderToBuffer` in a Server Action.** NOT API-route-with-stream. Rationale: we cache PDFs to Supabase Storage and the client downloads from the stored URL — generate-once, serve-from-CDN. `renderToStream` is the right pattern for per-request rendering; we don't do that.
- **`lib/pdf/invoice-pdf.tsx` has `import "server-only"` at the top — non-negotiable.** `@react-pdf/renderer`'s Node entry pulls pdf-lib and is heavyweight. A Client Component import would drag all of it into the browser bundle. The directive makes that a build error instead of a production surprise. Helvetica is the only font (built-in); no `Font.register()`, no TTF bundling for MVP.
- **PDF storage path: `invoices/{invoiceNumber}.pdf` in the `kampono_bucket` (same bucket as POD photos).** `POD_BUCKET` + `INVOICE_FOLDER` constants in `lib/supabase-admin.ts`. Using the invoice number (not the row id) as the filename because it's human-readable — finance pulling a PDF directly from the bucket will recognize `INV-2026-00001.pdf` at a glance.
- **Orphan-PDF TODO — acknowledged, deferred.** Ordering is: mint invoice number → render PDF → upload to Storage → create Invoice row in transaction. If the transaction fails AFTER the upload succeeds (e.g. `P2002` collision caught but the retry succeeds against a fresh number), the earlier attempt's PDF stays in Storage with no matching Invoice row pointing at it. For MVP this is acceptable — at DGK's volume the race is near-zero, and the storage cost is trivial. `TODO(phase-2): add a scheduled cleanup job that lists objects under invoices/ and deletes any whose invoice number doesn't match an existing Invoice row.`
- **PPN rendering in the PDF is exact text: `"PPN 1.1% (DPP Nilai Lain)"`.** The parenthetical is load-bearing — it signals to an Indonesian accountant that this is the freight-specific effective rate under PMK-71/PMK.03/2022, not a typo for the headline 11%. A code comment next to the styled Text element spells this out so a future refactor doesn't shorten the label.
- **Internal-reference disclaimer in the PDF footer is visually distinct — 8pt grey italic.** Reads "Internal reference — not a tax invoice (Faktur Pajak) number." The visual subordination matters: if the disclaimer looked like part of the invoice body, someone could mistake our internal ID for an officially-registered Faktur Pajak, which is a DGK compliance problem. When Dylan confirms the DJP-regulated Faktur format, we add those numbers as a separate field and keep our internal numbering for cross-references.
- **`nextFromLatest(prefix, latest)` extracted in `lib/numbering.ts`** after the third concrete instance (`nextOrderNumber`, `nextDONumber`, `nextInvoiceNumber`) confirmed the duplication was literal. The three Prisma queries stay inline because the model reference + column name are the only meaningful differences — abstracting those via callback would add indirection without saving enough lines to justify it. Full-wrapper `makeNumberGenerator` was evaluated and rejected: the callback boilerplate roughly cancels the savings.
- **`INVOICE_CREATE_ROLES` widened to include `FINANCE_ADMIN`** alongside ADMIN and OPS_MANAGER. Finance is specifically who cuts invoices; this is the first action surface they have mutate-rights to. Other DO mutations (status transitions, checklist, POD upload/verify) remain OPS_MANAGER/ADMIN.
- **`StatusBadge` extended to cover all four status enums** (Order, DO, Invoice, Payment). Added labels for `SENT`, `OVERDUE`, `CONFIRMED`; emerald override on `CONFIRMED` matches the success-language we use for `DELIVERED` and `PAID`. Single component now handles every status display site in the app.

## 2026-04-16 — Module 9: payment recording

- **Payment recording lives on `/invoices/[id]`, role-gated to FINANCE_ADMIN + ADMIN.** Ops tracks deliveries; finance books cash. Ops sees a "Only Finance or Admin can record payments" message in the form slot.
- **Partial payments are supported from day one.** Invoice stays `SENT` until cumulative `CONFIRMED` payments reach `totalIDR`; flip is `>= totalIDR` rather than `=== totalIDR` so any floating-point drift couldn't leave an invoice stuck (we use ints, but cheap insurance). Payments can repeat until the invoice is `PAID` or `CANCELLED`.
- **Overpayment guard returns the remaining balance in the error.** When `amount + priorConfirmedTotal > invoice.totalIDR` the action rejects with `"Payment of Rp X would exceed invoice total of Rp Y. Remaining balance is Rp Z."` so the user knows exactly what number to enter. Remaining balance is also shown live under the amount field in the form (`Remaining: Rp Z · This payment: Rp X`).
- **Payment proof upload is optional.** Same trust boundaries as POD (Module 7): JPG/PNG/WebP/PDF, ≤ 2 MiB, server-generated path, service-role admin client, public-read bucket. Folder constant `PAYMENT_PROOF_FOLDER = "payment-proofs"` in `lib/supabase-admin.ts`. Proof URLs stored in `Payment.proofUrl`.
- **Payment status = `CONFIRMED` on creation.** MVP has no "pending bank verification" workflow — recording a payment *is* confirming it. `PENDING` stays in the schema enum for Phase 2 when finance may want to queue a payment before marking it cleared.
- **Cascade flip: Invoice → PAID, then Order → PAID (terminal) when BOTH invoice types hit PAID.** Same transaction as the Payment insert. After the payment lands, aggregate confirmed payments; if ≥ invoice total, flip invoice. After invoice flip, check whether both `VENDOR_TO_DGK` and `DGK_TO_CUSTOMER` are PAID for this DO's parent Order; if yes, flip Order. `TODO(phase-2):` multi-DO orders need "all DOs have both invoices PAID", not just this DO's.
- **No `/payments/[id]` detail page.** Payment details are simple enough to render inline on the invoice detail page's prior-payments list + the `/payments` list. Can add later if audit trail needs a dedicated surface; the seed is not there yet.
- **Progress bar UX** on invoice detail makes partial payments visible without needing a text explanation. Line reads `Paid so far: {formatted} / {total} · {pct}%` with a thin `<div>` progress fill underneath.

## 2026-04-16 — Module 10: dashboard + MVP complete

- **Dashboard is six widgets + two tables, all read-only.** No new schema, no new primitives — every number is derived from existing data. Widgets: Active orders · Active deliveries · Outstanding invoices · AR outstanding · AP outstanding · Overdue invoices (red if > 0). Below the grid: Active Deliveries table (top 10, newest first), Overdue Invoices table (all invoices past due date + still DRAFT/SENT, oldest first). All widgets link to filtered list views.
- **AR/AP computed in app code, not SQL.** For each outstanding invoice, subtract sum-of-confirmed-payments from `totalIDR`, then sum across. Cleaner than a raw SQL aggregate under Prisma; at DGK's volume (<100 invoices) performance is a non-concern. If we ever exceed ~10k invoices we switch to a materialized view or a SQL window function.
- **All dashboard queries run under `Promise.all`** — eight concurrent reads on page load. First paint feels instant at MVP volumes.
- **`Mark as sent` button visibility tightened.** Previously the button was rendered whenever `invoice.status === DRAFT` regardless of role; now it also checks `canRecordPayment` (same FINANCE/ADMIN gate that controls the payment form). Consistent with the Cancel-order / Assign-vendor patterns elsewhere in the app. Ops users no longer see a button that would reject their click.
- **`npm run reset-demo`** wipes operational rows (Payment, Invoice, POD, DeliveryChecklist, DeliveryOrder, Order) in FK-safe order and leaves the seed (orgs, vendor, customers, users, rate card) intact. Purpose: between Dylan demos, reset to "blank operational state" in a few seconds without a full `prisma migrate reset`. Does NOT clean Supabase Storage — orphan POD photos, invoice PDFs, and payment proofs persist and will be addressed by the phase-2 Storage GC job.
- **Pre-deploy placeholder replacement checklist** added at the top of this file. Every `[DEV PLACEHOLDER]` in `prisma/seed.ts` is cross-listed here with grouping by entity, so the pre-demo / pre-production sweep is a checkbox exercise rather than a grep session.
- **MVP is complete.** End-to-end flow verified in browser: Order creation → Vendor assignment (rate-card lookup, frozen price) → Status transitions (PENDING → ACKNOWLEDGED → DISPATCHED) → Checklist → POD upload → POD verification (DO + Order → DELIVERED) → Vendor invoice PDF → Customer invoice PDF (Order → INVOICED) → Partial + full payment recording → Order → PAID. Role gates (Ops vs Finance) verified. Indonesian tax rules (PPN 1.1%) verified on-pixel. Status badges, PDF rendering, sidebar nav, dashboard widgets, and overdue tracking all functional.

- **Next 16 renamed `middleware.ts` → `proxy.ts`** (per `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`). Proxy is **Node runtime only** in 16.x; `edge` isn't supported and docs promise a future minor will reopen it. File and function are both called `proxy`; config flags followed (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`). Discovered while reading the Next 16 docs per the AGENTS.md warning — exactly the payoff that warning was pointing at.
- **Kept the `auth.config.ts` / `auth.ts` edge-safe split even though proxy is Node today.** No Prisma or bcryptjs in `auth.config.ts` means if edge returns for proxy in a later Next minor (or if we add a separate edge route that needs auth), the split is already in place. Cost is zero.
- **NextAuth v5 beta.31 shape confirmed** from `node_modules/next-auth/index.d.ts`: `const { handlers, auth, signIn, signOut } = NextAuth(config)`; Credentials provider at `next-auth/providers/credentials`; `AuthError` and `CredentialsSignin` exported from the `next-auth` root.
- **`Credentials.authorize()` returns `null` on any failure** rather than throwing. Throwing a non-`CredentialsSignin` error crashes the callback route and the login silently fails — `null` is the documented "wrong credentials" signal that produces a clean re-render of the form with `error=CredentialsSignin`.
- **`callbackUrl` is sanitized** on the login page: only accept paths starting with `/` and not `//` (which would be protocol-relative → open-redirect). Anything else falls through to `/dashboard`.
- **Belt-and-suspenders auth:** proxy blocks unauthenticated requests at the matcher; `app/(dgk)/layout.tsx` re-checks in the Server Component render as backstop *and* enforces the role whitelist (`ADMIN | OPS_MANAGER | FINANCE_ADMIN`). Proxy deliberately doesn't do the role check — that policy lives next to the route group it protects.
- **`AUTH_SECRET` generated locally via `openssl rand -base64 32`** and written to `.env`. `.env.example` ships a placeholder string; every dev rotates their own value. Missing `AUTH_SECRET` in prod makes NextAuth fail to persist any session.
- **`lib/db.ts` uses the same `@prisma/adapter-pg` wiring as `prisma/seed.ts`,** cached on `globalThis.__prisma__` in dev so Next's module reloading doesn't exhaust the pooler.
