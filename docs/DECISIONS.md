# Decisions log

Chronological record of non-obvious calls. One line per decision, one line per
why. Append, don't rewrite — this is a trail, not a spec. When a decision here
contradicts the code, the code is the current truth and a new entry should
replace it (cite the old one's date).

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
