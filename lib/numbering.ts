/**
 * Number generation for orders, delivery orders, and invoices.
 *
 * Format (see docs/DECISIONS.md):
 *   ORD-YYYY-NNNNN   e.g. ORD-2026-00001
 *   DO-YYYY-NNNNN    e.g. DO-2026-00001
 *   INV-YYYY-NNNNN   e.g. INV-2026-00001
 *
 * `nextOrderNumber()` queries the current max and adds one, which races
 * under concurrent creates. Callers must wrap `db.order.create()` in a
 * retry loop keyed on Prisma P2002 specifically targeting the
 * `orderNumber` unique constraint. See `app/(dgk)/orders/actions.ts`.
 *
 * Faktur Pajak DJP-regulated invoice numbers will coexist with
 * `invoiceNumber` once Dylan confirms the format (SPEC open question #4).
 */

import { db } from "@/lib/db"

const pad = (n: number) => n.toString().padStart(5, "0")
const year = () => new Date().getFullYear()

export async function nextOrderNumber(): Promise<string> {
  const y = year()
  const prefix = `ORD-${y}-`
  const row = await db.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  })
  const lastN = row ? parseInt(row.orderNumber.split("-")[2], 10) : 0
  return `${prefix}${pad(lastN + 1)}`
}

export async function nextDONumber(): Promise<string> {
  const y = year()
  const prefix = `DO-${y}-`
  const row = await db.deliveryOrder.findFirst({
    where: { doNumber: { startsWith: prefix } },
    orderBy: { doNumber: "desc" },
    select: { doNumber: true },
  })
  const lastN = row ? parseInt(row.doNumber.split("-")[2], 10) : 0
  return `${prefix}${pad(lastN + 1)}`
}

// TODO(module-7): replace with a db-backed impl when invoice generation lands.
export function nextInvoiceNumber(): string {
  return `INV-${year()}-${pad(1)}`
}
