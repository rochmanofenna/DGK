/**
 * Demo reset — nukes operational rows but keeps the seed (Organizations,
 * Vendor, Customers, Users, RateCard, RateCardEntries).
 *
 * Purpose: between Dylan demos, reset to "seed-only" state in a few
 * seconds without re-running `prisma migrate reset` (which would
 * re-migrate the schema and take much longer).
 *
 * Run:  npm run reset-demo
 *
 * Does NOT touch Supabase Storage. Orphan POD photos + invoice PDFs +
 * payment proofs will persist — flagged as phase-2 GC in DECISIONS.md.
 * Storage cost is fractions of a cent; not worth the script complexity.
 */
import "dotenv/config"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "./generated/client"

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  })

  const before = {
    orders: await db.order.count(),
    deliveryOrders: await db.deliveryOrder.count(),
    checklist: await db.deliveryChecklist.count(),
    pods: await db.proofOfDelivery.count(),
    invoices: await db.invoice.count(),
    payments: await db.payment.count(),
  }
  console.log("Before reset:")
  for (const [k, v] of Object.entries(before)) {
    console.log(`  ${k.padEnd(16)} ${v}`)
  }

  // FK-safe deletion order: leaf → root.
  // Payment → Invoice → POD → Checklist → DO → Order
  const payments = await db.payment.deleteMany({})
  const invoices = await db.invoice.deleteMany({})
  const pods = await db.proofOfDelivery.deleteMany({})
  const checklists = await db.deliveryChecklist.deleteMany({})
  const deliveryOrders = await db.deliveryOrder.deleteMany({})
  const orders = await db.order.deleteMany({})

  console.log("")
  console.log("Deleted:")
  console.log(`  payments         ${payments.count}`)
  console.log(`  invoices         ${invoices.count}`)
  console.log(`  PODs             ${pods.count}`)
  console.log(`  checklist        ${checklists.count}`)
  console.log(`  delivery orders  ${deliveryOrders.count}`)
  console.log(`  orders           ${orders.count}`)

  const seed = {
    organizations: await db.organization.count(),
    vendors: await db.vendor.count(),
    customers: await db.customer.count(),
    users: await db.user.count(),
    rateCards: await db.rateCard.count(),
    rateCardEntries: await db.rateCardEntry.count(),
  }
  console.log("")
  console.log("Seed rows (untouched):")
  for (const [k, v] of Object.entries(seed)) {
    console.log(`  ${k.padEnd(18)} ${v}`)
  }
  console.log("")
  console.log("Reset complete. Dashboard should show zeros across all widgets.")

  await db.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  process.exit(1)
})
