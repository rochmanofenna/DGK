/**
 * Number generation for orders, delivery orders, and invoices.
 *
 * Format (see docs/DECISIONS.md):
 *   ORD-YYYY-NNNNN   e.g. ORD-2026-00001
 *   DO-YYYY-NNNNN    e.g. DO-2026-00001
 *   INV-YYYY-NNNNN   e.g. INV-2026-00001
 *
 * MVP: hardcoded stubs. Real implementations at the first minting site
 * (Order creation) will query the most recent row of the same year for
 * the same type and increment. Faktur Pajak DJP-regulated invoice
 * numbers coexist with `invoiceNumber` once Dylan confirms their format
 * — see SPEC open question #4.
 */

const year = () => new Date().getFullYear()
const pad = (n: number) => n.toString().padStart(5, "0")

// TODO(mvp-seed): replace stubs with DB-backed counters at first-mint site.
export function nextOrderNumber(): string {
  return `ORD-${year()}-${pad(1)}`
}

export function nextDONumber(): string {
  return `DO-${year()}-${pad(1)}`
}

export function nextInvoiceNumber(): string {
  return `INV-${year()}-${pad(1)}`
}
