/**
 * Indonesian Rupiah (IDR) formatting utilities.
 *
 * IDR has no decimal subunits in daily use; all amounts are stored as
 * integers (whole rupiah). The id-ID locale produces "." as the thousand
 * separator; the prefix is "Rp" followed by a non-breaking space.
 *
 * Example: 4_500_000 -> "Rp 4.500.000"
 */

const IDR_CURRENCY_FORMATTER = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const IDR_NUMBER_FORMATTER = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatIDR(amount: number): string {
  return IDR_CURRENCY_FORMATTER.format(amount)
}

export function formatIDRNumber(amount: number): string {
  return IDR_NUMBER_FORMATTER.format(amount)
}

/**
 * Parse a user-entered rupiah string back to an integer.
 * Accepts "Rp 4.500.000", "4.500.000", "4500000" — strips non-digits.
 * Does not support decimals (there are no sub-rupiah in ERP use).
 */
export function parseIDR(input: string): number {
  const digits = input.replace(/\D/g, "")
  if (!digits) return 0
  return Number.parseInt(digits, 10)
}
