/**
 * Number generation for orders, delivery orders, and invoices.
 *
 * Format (see docs/DECISIONS.md):
 *   ORD-YYYY-NNNNN   e.g. ORD-2026-00001
 *   DO-YYYY-NNNNN    e.g. DO-2026-00001
 *   INV-YYYY-NNNNN   e.g. INV-2026-00001
 *
 * Each generator queries the current max for the year and adds one, which
 * races under concurrent creates — callers must wrap `create()` in a retry
 * loop keyed on Prisma's P2002 unique-constraint error on the specific
 * number column.
 *
 * The parse/pad/format tail is identical across all three, so it's
 * extracted into `nextFromLatest`. The Prisma query stays inline because
 * the model reference + column name are the only truly different bits,
 * and inlining reads cleaner than abstracting those via callback.
 *
 * Faktur Pajak DJP-regulated invoice numbers (SPEC open question #4) will
 * coexist with `invoiceNumber` once Dylan confirms the format.
 */

import { db } from "@/lib/db"

const pad = (n: number) => n.toString().padStart(5, "0")
const year = () => new Date().getFullYear()

/**
 * Given a prefix like "ORD-2026-" and the latest full number already in
 * use for that prefix (or null if none), return the next number.
 */
function nextFromLatest(prefix: string, latest: string | null): string {
  const lastN = latest ? parseInt(latest.split("-")[2], 10) : 0
  return `${prefix}${pad(lastN + 1)}`
}

export async function nextOrderNumber(): Promise<string> {
  const prefix = `ORD-${year()}-`
  const row = await db.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  })
  return nextFromLatest(prefix, row?.orderNumber ?? null)
}

export async function nextDONumber(): Promise<string> {
  const prefix = `DO-${year()}-`
  const row = await db.deliveryOrder.findFirst({
    where: { doNumber: { startsWith: prefix } },
    orderBy: { doNumber: "desc" },
    select: { doNumber: true },
  })
  return nextFromLatest(prefix, row?.doNumber ?? null)
}

export async function nextInvoiceNumber(): Promise<string> {
  const prefix = `INV-${year()}-`
  const row = await db.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  })
  return nextFromLatest(prefix, row?.invoiceNumber ?? null)
}
