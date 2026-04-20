import { InvoiceType } from "@/prisma/generated/enums"

/**
 * Multi-tenant query scopes for the carrier/vendor portal.
 *
 * Mirrors `lib/customer-queries.ts` deliberately — same shape, same
 * contract ("single source of truth for the tenancy filter"). The two
 * helpers have enough in common that a future extraction is tempting,
 * but the matching pair only covers two tenants (vendor + customer) so
 * per our "abstract after two" rule we keep them parallel for now; the
 * third caller (if one ever appears) is the signal to collapse them.
 *
 * Every `db.deliveryOrder.findMany` / `db.invoice.findMany` in
 * `app/(vendor)/` MUST pass through these helpers. Forgetting the
 * filter is a cross-tenant leak.
 */

export function vendorDeliveryScope(organizationId: string) {
  return { vendor: { organizationId } } as const
}

/**
 * Vendors only see their VENDOR_TO_DGK invoices (the ones DGK pays them).
 * DGK_TO_CUSTOMER invoices live on the same table but must never be
 * visible to a vendor, so the type filter is baked in.
 */
export function vendorInvoiceScope(organizationId: string) {
  return {
    fromOrgId: organizationId,
    type: InvoiceType.VENDOR_TO_DGK,
  } as const
}
