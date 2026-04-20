import { InvoiceType } from "@/prisma/generated/enums"

/**
 * Multi-tenant query scopes for the customer portal.
 *
 * These helpers are the single source of truth for the "scope by org"
 * filter. Every `db.order.findMany` / `db.invoice.findMany` in
 * `app/(customer)/` must use them — forgetting the filter is a data
 * leak, so the helper exists to make the filter the path of least
 * resistance rather than a thing you have to remember.
 *
 * Intentionally minimal: no pagination, no sorting, no extra filters.
 * Pages compose these with their own `where` conditions.
 */

export function customerOrderScope(organizationId: string) {
  return { customer: { organizationId } } as const
}

/**
 * Customer invoices are the `DGK_TO_CUSTOMER` invoices where `toOrg` is
 * the customer's org. Vendor → DGK invoices live on the same table but
 * must never be visible to a customer, so the type filter is baked in.
 */
export function customerInvoiceScope(organizationId: string) {
  return {
    toOrgId: organizationId,
    type: InvoiceType.DGK_TO_CUSTOMER,
  } as const
}
