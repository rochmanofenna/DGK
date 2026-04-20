/**
 * DGK ERP — dev seed data.
 *
 * ⚠  DEV ONLY — rotate every placeholder before any real user or demo
 *    touches this system. Grep for `[DEV PLACEHOLDER]` to find each field
 *    that needs a real value from Dylan.
 *
 * Placeholders in this file (find-and-replace when reals arrive):
 *   - DGK user passwords (ops-dev-pw-change-me, finance-dev-pw-change-me)
 *   - Customer user passwords (berkah/sumber/arumi-dev-pw-change-me)
 *   - User names (Rina Pratama, Bayu Santoso, + 3 customer contacts)
 *   - DGK: address, taxId, contactPerson, phone, bankName, bankAccount
 *   - Transcoll: address, taxId (other fields come from SPEC §11 verbatim)
 *   - All 3 customers: names, taxIds, addresses, contactPerson, phone
 *   - All 3 customer creditTermsDays (pending Dylan — SPEC open Q)
 *   - All 3 customer-user real emails (placeholder .dev domains for now)
 *
 * Idempotent: every seeded row uses a stable `seed_*` id so re-runs update
 * in place instead of creating duplicates.
 *
 * Run: npx prisma db seed
 */

import "dotenv/config"

import { hash } from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Region, TruckType } from "./generated/client"

// Prisma 7 requires a driver adapter for direct connections. Using the
// node-postgres adapter against the Session pooler URL. Runtime-side (in
// lib/db.ts) will mirror this pattern.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ⚠ DEV ONLY — distinct password per role so wrong-role session bugs are
// visible in testing (identical passwords would mask a login that didn't
// actually switch). Customer users each get a distinct password too so
// cross-tenant leak tests can't accidentally succeed by typing the wrong
// creds and happening to land somewhere real.
const PASSWORDS: Record<string, string> = {
  "ops@dgk.dev":               "ops-dev-pw-change-me",
  "finance@dgk.dev":           "finance-dev-pw-change-me",
  "customer@berkahpangan.dev": "berkah-dev-pw-change-me",
  "customer@sumberrasa.dev":   "sumber-dev-pw-change-me",
  "customer@arumi.dev":        "arumi-dev-pw-change-me",
}

async function seedOrganizations() {
  // DGK (us). Plausible Jakarta placeholders so invoice PDFs render
  // realistically in dev. Every [DEV PLACEHOLDER] value gets replaced
  // with real data when Dylan provides it.
  await prisma.organization.upsert({
    where: { id: "seed_dgk_org" },
    create: {
      id: "seed_dgk_org",
      type: "DGK",
      name: "PT Dinamika Global Korpora",
      address: "Jl. Jenderal Sudirman No. 1, Jakarta Pusat 10220, DKI Jakarta", // [DEV PLACEHOLDER]
      taxId: "01.234.567.8-012.000",                                            // [DEV PLACEHOLDER]
      contactPerson: "Dylan",                                                   // [DEV PLACEHOLDER]
      phone: "+62 21 5555 0100",                                                // [DEV PLACEHOLDER]
      email: "hello@dgk.dev",
      bankName: "BCA",                                                          // [DEV PLACEHOLDER]
      bankAccount: "012 3456789",                                               // [DEV PLACEHOLDER]
    },
    update: {},
  })

  // Transcoll (primary vendor). SPEC §11 verbatim where available.
  await prisma.organization.upsert({
    where: { id: "seed_transcoll_org" },
    create: {
      id: "seed_transcoll_org",
      type: "VENDOR",
      name: "PT Tiga Sejuk Logistik",
      address: "Sentul / Cileungsi / Narogong area, West Java",                 // [DEV PLACEHOLDER]
      taxId: "02.345.678.9-023.000",                                            // [DEV PLACEHOLDER — Transcoll NPWP not in SPEC]
      contactPerson: "Didik Setiyanto",
      phone: "0812-1257-3212",
      email: "didik@cbstranscoll.co.id",
      bankName: "BCA",
      bankAccount: "873 1139245",
    },
    update: {},
  })

  // Customer fixtures — all food-sector to exercise Transcoll's cold-chain
  // / halal / frozen service. Names / NPWPs fabricated but format-valid.
  // Informal sector notes (no DB field, just intent):
  //   berkah    = frozen-food distributor
  //   sumberrasa = chilled-produce trader
  //   arumi     = cold-chain food supplier
  await prisma.organization.upsert({
    where: { id: "seed_cust_berkah_org" },
    create: {
      id: "seed_cust_berkah_org",
      type: "CUSTOMER",
      name: "PT Berkah Pangan Nusantara",                                       // [DEV PLACEHOLDER]
      address: "Jl. Raya Bogor KM 26, Jakarta Timur 13750, DKI Jakarta",        // [DEV PLACEHOLDER]
      taxId: "01.234.567.8-901.000",                                            // [DEV PLACEHOLDER]
      contactPerson: "Ibu Sari",                                                // [DEV PLACEHOLDER]
      phone: "+62 21 8715 0200",                                                // [DEV PLACEHOLDER]
      email: "ops@berkahpangan.dev",
    },
    update: {},
  })
  await prisma.organization.upsert({
    where: { id: "seed_cust_sumber_org" },
    create: {
      id: "seed_cust_sumber_org",
      type: "CUSTOMER",
      name: "CV Sumber Rasa Segar",                                             // [DEV PLACEHOLDER]
      address: "Pasar Induk Kramat Jati, Jakarta Timur 13540, DKI Jakarta",     // [DEV PLACEHOLDER]
      taxId: "02.345.678.9-012.000",                                            // [DEV PLACEHOLDER]
      contactPerson: "Pak Agus",                                                // [DEV PLACEHOLDER]
      phone: "+62 21 8780 0350",                                                // [DEV PLACEHOLDER]
      email: "ops@sumberrasa.dev",
    },
    update: {},
  })
  await prisma.organization.upsert({
    where: { id: "seed_cust_arumi_org" },
    create: {
      id: "seed_cust_arumi_org",
      type: "CUSTOMER",
      name: "PT Arumi Mitra Boga",                                              // [DEV PLACEHOLDER]
      address: "Kawasan Industri MM2100 Blok K-5, Cikarang Barat, Bekasi 17520", // [DEV PLACEHOLDER]
      taxId: "03.456.789.0-123.000",                                            // [DEV PLACEHOLDER]
      contactPerson: "Ibu Mega",                                                // [DEV PLACEHOLDER]
      phone: "+62 21 8998 1450",                                                // [DEV PLACEHOLDER]
      email: "ops@arumiboga.dev",
    },
    update: {},
  })
}

async function seedVendorProfile() {
  await prisma.vendor.upsert({
    where: { organizationId: "seed_transcoll_org" },
    create: {
      id: "seed_transcoll_vendor",
      organizationId: "seed_transcoll_org",
      paymentTermsDays: 14,
      isActive: true,
    },
    update: {
      paymentTermsDays: 14,
      isActive: true,
    },
  })
}

async function seedCustomerProfiles() {
  const customers = [
    { id: "seed_cust_berkah", organizationId: "seed_cust_berkah_org", creditTermsDays: 30 }, // [DEV PLACEHOLDER]
    { id: "seed_cust_sumber", organizationId: "seed_cust_sumber_org", creditTermsDays: 30 }, // [DEV PLACEHOLDER]
    { id: "seed_cust_arumi",  organizationId: "seed_cust_arumi_org",  creditTermsDays: 45 }, // [DEV PLACEHOLDER]
  ]
  for (const c of customers) {
    await prisma.customer.upsert({
      where: { organizationId: c.organizationId },
      create: c,
      update: { creditTermsDays: c.creditTermsDays },
    })
  }
}

async function seedUsers() {
  const opsHash = await hash(PASSWORDS["ops@dgk.dev"], 10)
  const financeHash = await hash(PASSWORDS["finance@dgk.dev"], 10)

  await prisma.user.upsert({
    where: { email: "ops@dgk.dev" },
    create: {
      id: "seed_user_ops",
      email: "ops@dgk.dev",
      passwordHash: opsHash,
      role: "OPS_MANAGER",
      name: "Rina Pratama",            // [DEV PLACEHOLDER]
      phone: "+62 811 1000 001",       // [DEV PLACEHOLDER]
      organizationId: "seed_dgk_org",
    },
    update: { passwordHash: opsHash },
  })

  await prisma.user.upsert({
    where: { email: "finance@dgk.dev" },
    create: {
      id: "seed_user_finance",
      email: "finance@dgk.dev",
      passwordHash: financeHash,
      role: "FINANCE_ADMIN",
      name: "Bayu Santoso",            // [DEV PLACEHOLDER]
      phone: "+62 811 1000 002",       // [DEV PLACEHOLDER]
      organizationId: "seed_dgk_org",
    },
    update: { passwordHash: financeHash },
  })

  // Customer users. One per seeded customer org — deliberate so cross-tenant
  // isolation is visible: log in as berkah, you should never see sumber's
  // orders or invoices. If you can, `customerOrderScope` / `customerInvoiceScope`
  // has a bug and it's a data leak, not a UI glitch.
  const customerUsers = [
    {
      id:             "seed_user_cust_berkah",
      email:          "customer@berkahpangan.dev",
      organizationId: "seed_cust_berkah_org",
      name:           "Ibu Sari",                 // [DEV PLACEHOLDER]
      phone:          "+62 811 2000 001",         // [DEV PLACEHOLDER]
    },
    {
      id:             "seed_user_cust_sumber",
      email:          "customer@sumberrasa.dev",
      organizationId: "seed_cust_sumber_org",
      name:           "Pak Agus",                 // [DEV PLACEHOLDER]
      phone:          "+62 811 2000 002",         // [DEV PLACEHOLDER]
    },
    {
      id:             "seed_user_cust_arumi",
      email:          "customer@arumi.dev",
      organizationId: "seed_cust_arumi_org",
      name:           "Ibu Mega",                 // [DEV PLACEHOLDER]
      phone:          "+62 811 2000 003",         // [DEV PLACEHOLDER]
    },
  ]
  for (const cu of customerUsers) {
    const pwHash = await hash(PASSWORDS[cu.email], 10)
    await prisma.user.upsert({
      where: { email: cu.email },
      create: {
        id: cu.id,
        email: cu.email,
        passwordHash: pwHash,
        role: "CUSTOMER_USER",
        name: cu.name,
        phone: cu.phone,
        organizationId: cu.organizationId,
      },
      // Rehash on re-seed so password rotation in PASSWORDS propagates.
      update: { passwordHash: pwHash },
    })
  }
}

async function seedRateCard() {
  const card = await prisma.rateCard.upsert({
    where: { id: "seed_transcoll_ratecard_v1" },
    create: {
      id: "seed_transcoll_ratecard_v1",
      vendorId: "seed_transcoll_vendor",
      effectiveDate: new Date("2025-01-01"),
      expiryDate: null,
      notes:
        "Prices exclude insurance, PPN 1.1%, quarantine, TKBM. Cold chain (chilled/frozen), halal only. Source: Transcoll PDF (SPEC §11).",
      // extraPointChargeIDR / overnightChargeIDR use their column defaults
      // (200_000 / 300_000), which match Transcoll's Notes section.
    },
    update: {},
  })

  // 16 priced cells from the Transcoll matrix. Origin is always
  // SENTUL_CILEUNGSI_NAROGONG.
  //   Both trucks:  BANDUNG, BEKASI, JAKARTA, DEPOK, BOGOR, TANGERANG
  //   Tronton only: SEMARANG, YOGYAKARTA, PALEMBANG, JAMBI
  const origin = Region.SENTUL_CILEUNGSI_NAROGONG
  const entries = [
    { destinationRegion: Region.BANDUNG,    truckType: TruckType.CDEL_2T,     priceIDR:  1_900_000 },
    { destinationRegion: Region.BANDUNG,    truckType: TruckType.TRONTON_20T, priceIDR:  4_500_000 },
    { destinationRegion: Region.SEMARANG,   truckType: TruckType.TRONTON_20T, priceIDR:  8_000_000 },
    { destinationRegion: Region.YOGYAKARTA, truckType: TruckType.TRONTON_20T, priceIDR:  8_500_000 },
    { destinationRegion: Region.PALEMBANG,  truckType: TruckType.TRONTON_20T, priceIDR: 17_500_000 },
    { destinationRegion: Region.JAMBI,      truckType: TruckType.TRONTON_20T, priceIDR: 20_000_000 },
    { destinationRegion: Region.BEKASI,     truckType: TruckType.CDEL_2T,     priceIDR:  1_000_000 },
    { destinationRegion: Region.BEKASI,     truckType: TruckType.TRONTON_20T, priceIDR:  3_000_000 },
    { destinationRegion: Region.JAKARTA,    truckType: TruckType.CDEL_2T,     priceIDR:  1_000_000 },
    { destinationRegion: Region.JAKARTA,    truckType: TruckType.TRONTON_20T, priceIDR:  3_000_000 },
    { destinationRegion: Region.DEPOK,      truckType: TruckType.CDEL_2T,     priceIDR:  1_000_000 },
    { destinationRegion: Region.DEPOK,      truckType: TruckType.TRONTON_20T, priceIDR:  3_000_000 },
    { destinationRegion: Region.BOGOR,      truckType: TruckType.CDEL_2T,     priceIDR:  1_200_000 },
    { destinationRegion: Region.BOGOR,      truckType: TruckType.TRONTON_20T, priceIDR:  3_300_000 },
    { destinationRegion: Region.TANGERANG,  truckType: TruckType.CDEL_2T,     priceIDR:  1_200_000 },
    { destinationRegion: Region.TANGERANG,  truckType: TruckType.TRONTON_20T, priceIDR:  3_300_000 },
  ]

  for (const entry of entries) {
    await prisma.rateCardEntry.upsert({
      where: {
        rateCardId_originRegion_destinationRegion_truckType: {
          rateCardId: card.id,
          originRegion: origin,
          destinationRegion: entry.destinationRegion,
          truckType: entry.truckType,
        },
      },
      create: {
        rateCardId: card.id,
        originRegion: origin,
        destinationRegion: entry.destinationRegion,
        truckType: entry.truckType,
        priceIDR: entry.priceIDR,
      },
      update: {
        priceIDR: entry.priceIDR,
      },
    })
  }
  return entries.length
}

async function main() {
  // FK-safe order: orgs → vendor/customer profiles → users → rate card.
  await seedOrganizations()
  await seedVendorProfile()
  await seedCustomerProfiles()
  await seedUsers()
  const rateCount = await seedRateCard()

  console.log("Seed complete.")
  console.log(`  Organizations:   5 (1 DGK, 1 vendor, 3 customers)`)
  console.log(`  DGK users:       ops@dgk.dev / ${PASSWORDS["ops@dgk.dev"]}`)
  console.log(`                   finance@dgk.dev / ${PASSWORDS["finance@dgk.dev"]}`)
  console.log(`  Customer users:  customer@berkahpangan.dev / ${PASSWORDS["customer@berkahpangan.dev"]}`)
  console.log(`                   customer@sumberrasa.dev  / ${PASSWORDS["customer@sumberrasa.dev"]}`)
  console.log(`                   customer@arumi.dev       / ${PASSWORDS["customer@arumi.dev"]}`)
  console.log(`  Vendor:          Transcoll (seed_transcoll_vendor)`)
  console.log(`  Customers:       Berkah Pangan, Sumber Rasa, Arumi Boga`)
  console.log(`  Rate card:       seed_transcoll_ratecard_v1, ${rateCount} entries`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
