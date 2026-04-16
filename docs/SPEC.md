# DGK Logistics ERP — Technical Specification

> **Client:** PT Dinamika Global Korpora (DGK)
> **Project:** Logistics ERP System
> **Version:** 0.1 (Prototype Spec)
> **Status:** MVP scope locked, open questions flagged inline

---

## 1. Overview

DGK is a logistics broker. They sit between **customers** (who need goods shipped) and **vendors** (trucking companies like Transcoll, PT Tiga Sejuk Logistik). DGK receives an order, matches it to a vendor, supervises the delivery, and handles all invoicing + payment reconciliation between the three parties.

This ERP replaces the current ad-hoc process (WhatsApp, email, phone, Excel) with a single system that handles the full order → delivery → invoicing → payment lifecycle.

### Core value proposition of the system
- **One source of truth** for orders, deliveries, invoices, payments
- **Multi-party coordination** — customer ↔ DGK ↔ vendor all see the same data
- **Finance automation** — invoices generated automatically with pre-agreed pricing and margins
- **Operational visibility** — Ops Manager sees live status of every shipment

---

## 2. Business Context

### The three parties

| Party | Role | Examples |
|-------|------|----------|
| **Customer** | Orders shipping (has goods to move) | DGK's clients |
| **DGK (us)** | Broker / coordinator | PT Dinamika Global Korpora |
| **Vendor** | Fulfills delivery (owns trucks) | Transcoll / PT Tiga Sejuk Logistik |

### Money flow
1. Vendor invoices DGK (their rate, e.g., Bandung route Tronton = Rp 4,500,000)
2. DGK invoices Customer (DGK's rate = vendor cost + margin)
3. Customer pays DGK → DGK pays Vendor (14-day terms based on Transcoll contract)

### Document flow
1. Customer submits **Order** (packing list, manifest, date, truck type, route)
2. DGK creates **Delivery Order (DO)** linked to a selected vendor
3. DGK sends DO + shipment info + permission document to vendor
4. Vendor dispatches trucks, status updates flow back to DGK
5. Upon delivery, **Proof of Delivery (POD)** is uploaded/verified
6. Vendor issues **Invoice to DGK**
7. DGK issues **Invoice to Customer** (with markup)
8. Payments logged, finance books updated

---

## 3. User Roles & Permissions

| Role | Count | Permissions |
|------|-------|-------------|
| **Ops Manager** (DGK) | 1+ | Create/edit orders, assign vendors, monitor deliveries, generate DOs, verify POD |
| **Finance Admin** (DGK) | 1+ | View all orders, generate/send invoices, record payments, view accounting reports |
| **CTO / Super Admin** (DGK) | 1 | All permissions + user management, system config, rate card management |
| **Vendor User** | TBD (minimum a few) | View assigned DOs, update delivery checklist, upload POD, submit invoices |
| **Customer User** | TBD | Submit orders, view order status, download invoices, make payments |

> **Open question:** Do customers get self-service portal access in Phase 1, or do they email/WhatsApp and DGK inputs on their behalf? Recommendation: **DGK-inputs-on-behalf for MVP**, customer portal Phase 2.

---

## 4. Core Data Models

### Entity Relationship (high-level)
```
Customer ──┐
           ├─> Order ──> DeliveryOrder ──> POD ──> Invoice (vendor→DGK)
Vendor ────┘                                  └──> Invoice (DGK→customer)
                                                         └──> Payment
```

### Key entities

**`User`**
- id, email, password_hash, role, organization_id (FK), name, phone, created_at

**`Organization`**
- id, type (`customer` | `vendor` | `dgk`), name, address, tax_id (NPWP), contact_person, phone, email, bank_info

**`Vendor`** (extends Organization where type=vendor)
- id, organization_id, payment_terms_days (default 14), is_active

**`Customer`** (extends Organization where type=customer)
- id, organization_id, agreed_pricing_reference, credit_terms_days

**`RateCard`** (vendor pricing, based on Transcoll PDF structure)
- id, vendor_id, effective_date, expiry_date, notes (PPN, karantina, etc.)

**`RateCardEntry`**
- id, rate_card_id, origin_region, destination_region, truck_type (`CDEL_2T` | `TRONTON_20T` | extensible), price_idr, extra_point_charge, overnight_charge

**`Order`** (customer-facing)
- id, order_number, customer_id, created_by (user), status (`draft` | `submitted` | `assigned` | `in_transit` | `delivered` | `invoiced` | `paid` | `cancelled`), pickup_date, packing_list (JSON), manifest_description, required_truck_type, origin_address, destination_address, total_price_idr (customer-facing), notes, created_at

**`DeliveryOrder`** (DGK↔vendor)
- id, do_number, order_id (FK), vendor_id (FK), assigned_by (user), vendor_price_idr, status (`pending` | `acknowledged` | `dispatched` | `delivered` | `cancelled`), permission_document_url, dispatched_at, delivered_at

**`DeliveryChecklist`**
- id, delivery_order_id, checkpoint (`pickup` | `in_transit` | `arrived` | `unloading` | `completed`), timestamp, notes, photo_url, verified_by

**`ProofOfDelivery`**
- id, delivery_order_id, uploaded_by (vendor user), delivered_at, receiver_name, receiver_signature_url, photos (array), notes, verified_by_dgk (user), verified_at

**`Invoice`**
- id, invoice_number, type (`vendor_to_dgk` | `dgk_to_customer`), from_org_id, to_org_id, delivery_order_id (FK), issue_date, due_date, subtotal_idr, tax_idr (PPN 1.1%), total_idr, status (`draft` | `sent` | `paid` | `overdue` | `cancelled`), pdf_url

**`Payment`**
- id, invoice_id, amount_idr, payment_method (`bank_transfer` | `qris`), reference_number, paid_at, recorded_by (user), proof_url, status (`pending` | `confirmed`)

> **Currency note:** Everything in IDR (Indonesian Rupiah), stored as integer (no decimals for rupiah).

---

## 5. Complete Order Lifecycle (Happy Path)

This is the **critical flow** — everything else supports this.

### Step 1 — Order Intake
- Customer (or DGK on their behalf) creates an Order
- Fields: pickup date, origin/destination, truck type, manifest (what's being moved), packing list, special notes
- Status: `submitted`

### Step 2 — Vendor Assignment
- Ops Manager sees the order in their queue
- System suggests vendors based on: route coverage + truck type + rate card
- Ops picks a vendor → creates a **Delivery Order (DO)**
- System auto-calculates vendor cost from their RateCard
- Status: `assigned`

### Step 3 — Dispatch to Vendor
- DO + shipment info + permission document auto-sent to vendor (email + in-app notification)
- Vendor acknowledges in their portal
- Status: `acknowledged`

### Step 4 — In Transit
- Vendor updates DeliveryChecklist (pickup confirmed, in transit, arrived, unloading)
- DGK Ops monitors live in their dashboard
- Status: `in_transit` → `dispatched`

### Step 5 — Delivery + POD
- Vendor uploads POD: receiver name, signature, photos, timestamp
- DGK Ops verifies POD
- Status: `delivered`

### Step 6 — Vendor Invoices DGK
- Vendor generates Invoice (from DO) → submits in portal
- Finance Admin reviews → approves
- Status: `invoiced` (vendor side)

### Step 7 — DGK Invoices Customer
- System auto-generates customer invoice using DGK's agreed pricing for that customer/route
- Finance Admin reviews → sends PDF to customer
- Status: `invoiced` (customer side)

### Step 8 — Payment & Reconciliation
- Customer pays via bank transfer or QRIS → Finance records payment
- DGK pays vendor within 14 days → Finance records outgoing payment
- Status: `paid`

---

## 6. Module Breakdown

### 6.1 Auth & Org Management
- Email/password login (add Google OAuth later)
- Role-based access control (RBAC)
- Multi-tenant: each Organization (DGK, vendors, customers) only sees their own data
- Admin invites users via email

### 6.2 Order Management (DGK-facing)
- Order creation form (with customer picker, truck type, route, dates, manifest)
- Order list with filters (status, date, customer, vendor)
- Order detail view with full timeline

### 6.3 Vendor & Rate Card Management
- CRUD for vendors
- Rate card upload/entry (structured like Transcoll PDF: route × truck type × price)
- Rate card comparison tool for Ops (when picking a vendor)

### 6.4 Delivery Order Module
- Auto-generate DO from Order
- PDF export of DO (for email to vendor)
- Delivery checklist tracking
- POD upload & verification

### 6.5 Vendor Portal
- Login → see assigned DOs
- Acknowledge / update status
- Upload POD (photos, signature, receiver info)
- Submit invoices

### 6.6 Finance & Invoicing
- Auto-generate invoices from DOs (both vendor→DGK and DGK→customer)
- Invoice PDF generation (Indonesian format, PPN 1.1%)
- Payment recording (bank transfer reference, QRIS proof)
- Accounts receivable / accounts payable dashboards
- Export to Excel for accounting books

### 6.7 Dashboard & Reporting
- Ops dashboard: live deliveries, today's schedule, alerts
- Finance dashboard: outstanding invoices, cash position, aging report
- Vendor performance: on-time %, complaint rate

---

## 7. Tech Stack Recommendation

Chosen for speed of development, Copilot/AI compatibility, and low ops overhead.

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15 (App Router) + TypeScript | Full-stack in one repo, great AI tooling support |
| **UI** | shadcn/ui + Tailwind CSS | Pre-built components, easy to customize, looks professional |
| **DB** | PostgreSQL (via Supabase or Neon) | Reliable, cheap, Supabase gives auth + storage bonus |
| **ORM** | Prisma | Type-safe, great DX, Copilot writes clean Prisma code |
| **Auth** | NextAuth.js (or Supabase Auth) | RBAC, email+OAuth support out of the box |
| **File storage** | Supabase Storage / S3 | For POD photos, permission docs, invoice PDFs |
| **PDF generation** | `@react-pdf/renderer` or Puppeteer | For invoices, DOs |
| **Email** | Resend | Cheap, good DX, for vendor notifications |
| **Hosting** | Vercel | Zero-config Next.js deployment |
| **Language** | Bahasa Indonesia primary, English fallback | Their team is Indonesian |
| **Currency** | IDR with `Intl.NumberFormat('id-ID')` | Rp 4.500.000 formatting |

### Project structure
```
/app
  /(auth)/login
  /(dgk)/dashboard
  /(dgk)/orders
  /(dgk)/deliveries
  /(dgk)/vendors
  /(dgk)/invoices
  /(dgk)/finance
  /(vendor)/dashboard
  /(vendor)/deliveries
  /(customer)/orders       # Phase 2
  /api
/components
/lib
  /db (prisma)
  /auth
  /pdf
  /utils
/prisma
  schema.prisma
```

---

## 8. MVP Scope (Phase 1 — Prototype, 1–2 days)

**Goal:** Functional prototype showing the happy path end-to-end. Not production-ready, but demoable to Dylan.

### In scope
1. Auth for DGK users only (Ops Manager, Finance Admin)
2. Seed one vendor (Transcoll) with their full rate card
3. Seed 2–3 test customers
4. **Order creation** by Ops Manager (form with all fields)
5. **Vendor assignment** → auto-creates DO with vendor pricing
6. **DO detail page** with status timeline and manual status updates
7. **POD upload** (photo + receiver name, simple)
8. **Invoice auto-generation** (both sides) with PDF export
9. **Payment recording** (manual entry, no gateway integration)
10. Basic Ops dashboard (list of active deliveries)

### Out of scope (Phase 2+)
- Vendor portal login (DGK manually updates vendor status for MVP)
- Customer portal
- Payment gateway integration (Xendit/Midtrans)
- Email notifications (show in-app only for MVP)
- Accounting export
- Multiple rate cards / rate card comparison
- GPS tracking integration
- Mobile app
- Bahasa Indonesia localization (English for prototype, translate later)

### Success criteria for prototype demo
- Can create an order
- Can assign it to Transcoll
- Can see the DO with correct vendor pricing from rate card
- Can mark delivery complete + upload POD
- Can generate both invoices as PDFs
- Can record payment
- Full flow takes <5 minutes to click through

---

## 9. Phase 2 & Beyond

Once MVP is approved, roadmap:

**Phase 2 (2–3 weeks)**
- Vendor portal
- Bahasa Indonesia localization
- Email notifications
- Proper invoice numbering (Indonesian standards)
- Multiple rate cards, effective dating

**Phase 3 (3–4 weeks)**
- Customer portal
- Payment gateway (Xendit for QRIS + VA)
- Accounting export (Excel + optional Jurnal/Accurate integration)
- Reporting & analytics

**Phase 4**
- Mobile app (React Native) for vendors + Ops
- GPS integration (Transcoll trucks have GPS per their contract)
- Automated reconciliation
- Customer rate card management

---

## 10. Assumptions & Open Questions

### Assumptions made (flag with Dylan before finalizing)
- Customer orders go through DGK input in MVP (no customer self-service)
- DGK has pre-agreed pricing with each customer (stored as flat rate per route, not formula-based markup)
- Tax is PPN 1.1% on vendor invoices (per Transcoll contract); customer tax TBD
- Indonesian invoice format required but English UI acceptable for prototype
- Single currency (IDR), single country (Indonesia) for now
- File uploads up to 10MB (POD photos)

### Open questions for Dylan
1. **Customer pricing:** Flat agreed rate per customer/route, or vendor cost + % margin, or per-quote?
2. **Vendor pool size:** Just Transcoll for now, or are there others already contracted?
3. **Partner corps:** What is a "partner corp" vs. a vendor? Different role/permissions?
4. **Invoice numbering:** Does DGK have an existing numbering format that must be followed?
5. **Multi-location:** Does DGK have multiple offices/warehouses, or one HQ?
6. **Document templates:** Does he have existing templates for DO and permission documents?
7. **Budget & timeline:** Still unanswered — needed before Phase 2 starts
8. **Hosting:** Cloud (Vercel/AWS) or their own server?
9. **Data ownership:** Will they want a database export / self-hosted option eventually?
10. **Existing code:** Confirmed previous freelancer's code is unavailable — building fresh

---

## 11. Reference: Transcoll Rate Card (from supplied PDF)

Used as the canonical example of vendor rate card structure. Seed this into the DB as test data.

**Vendor:** PT Tiga Sejuk Logistik (Transcoll)
**Contact:** Didik Setiyanto — didik@cbstranscoll.co.id / 0812-1257-3212
**Bank:** BCA 873 1139245
**Payment terms:** 14 days after invoice

| Route | CDEL (2 Ton) | Tronton (20 Ton) |
|-------|--------------|-------------------|
| Sentul/Cileungsi/Narogong → Bandung | 1,900,000 | 4,500,000 |
| → Semarang | — | 8,000,000 |
| → Yogyakarta | — | 8,500,000 |
| → Palembang | — | 17,500,000 |
| → Jambi | — | 20,000,000 |
| → Bekasi | 1,000,000 | 3,000,000 |
| → Jakarta | 1,000,000 | 3,000,000 |
| → Depok | 1,000,000 | 3,000,000 |
| → Bogor | 1,200,000 | 3,300,000 |
| → Tangerang | 1,200,000 | 3,300,000 |

**Rules/fees:**
- Cold chain (Chilled/Frozen) trucks, halal only
- Price excludes insurance, PPN 1.1%, quarantine, loading/unloading labor (TKBM)
- 1 delivery point per CDEL; extra points Rp 200,000 each (one-way)
- 24hr overnight fee Rp 300,000 (if truck arrives before 15:00 WIB)
- On-call orders min H-1 by 16:00 WIB
- All trucks GPS-equipped
- Complaint window 1x24 hours post-delivery with supporting docs

---

## 12. Getting Started (for Copilot / the dev)

```bash
# 1. Initialize
npx create-next-app@latest dgk-erp --typescript --tailwind --app
cd dgk-erp

# 2. Install core deps
npm install @prisma/client next-auth bcryptjs zod
npm install -D prisma @types/bcryptjs

# 3. Install UI
npx shadcn@latest init
npx shadcn@latest add button input form table dialog card badge

# 4. Set up DB
# Create a Supabase/Neon project, grab the DATABASE_URL
npx prisma init

# 5. Define schema in prisma/schema.prisma using the data models in Section 4

# 6. Generate + migrate
npx prisma generate
npx prisma migrate dev --name init

# 7. Seed with Transcoll rate card (see Section 11)
npx prisma db seed
```

**First implementation targets (in order):**
1. Prisma schema matching Section 4 data models
2. Auth setup with two seeded users (Ops Manager + Finance Admin)
3. `/dashboard` with navigation shell
4. `/orders/new` form → creates Order record
5. `/orders/[id]` detail page with "Assign Vendor" action
6. `/deliveries/[id]` with status updates + POD upload
7. `/invoices/[id]` with PDF generation
8. Payment recording form

---

*End of spec. Review, adjust, then paste relevant sections into Copilot prompts as you build each module. Sections 4, 5, and 8 are the highest-priority for initial scaffolding.*
