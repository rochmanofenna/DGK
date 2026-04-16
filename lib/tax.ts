/**
 * Indonesian tax (PPN) utilities for freight / logistics invoices.
 *
 * PPN (Pajak Pertambahan Nilai) is Indonesia's VAT. The headline rate
 * is 11% (12% for some sectors as of 2025), but freight / cargo
 * forwarding services (Jasa Pengurusan Transportasi) use "DPP Nilai
 * Lain" per PMK-71/PMK.03/2022, where the taxable base is 10% of
 * gross revenue. The effective rate on gross is therefore
 * 11% × 10% = **1.1%**.
 *
 * This 1.1% effective rate is what the Transcoll vendor contract
 * charges DGK and what should appear on both vendor→DGK and DGK→
 * customer invoices under the freight scope.
 *
 * DO NOT "correct" this to 11%. It is not a typo — it is the
 * regulated effective rate for this service category.
 */

export const PPN_FREIGHT_RATE = 0.011 // 1.1%

export function calculatePPN(subtotalIDR: number): number {
  return Math.round(subtotalIDR * PPN_FREIGHT_RATE)
}

export interface InvoiceTotals {
  subtotal: number
  tax: number
  total: number
}

export function calculateInvoiceTotals(subtotalIDR: number): InvoiceTotals {
  const tax = calculatePPN(subtotalIDR)
  return { subtotal: subtotalIDR, tax, total: subtotalIDR + tax }
}
