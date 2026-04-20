import type { Session } from "next-auth"

import { auth } from "@/auth"
import { UserRole } from "@/prisma/generated/enums"

/**
 * Customer-portal multi-tenant guard. The session carries
 * `organizationId`; every query in `app/(customer)/` must filter by it so
 * one customer never sees another customer's data.
 *
 * `getCustomerOrgId` — sync; throws if a non-customer session is handed
 * in. Use in page Server Components where the parent layout has already
 * rejected non-CUSTOMER_USER roles (defence in depth: the throw protects
 * against layout drift).
 *
 * `requireCustomerOrg` — async; returns the same discriminated union as
 * `requireRole`. Use at the top of every Server Action in the customer
 * portal. Actions can't trust a prop-passed session.
 */
export type CustomerOrgCheck =
  | { ok: true; session: Session; organizationId: string }
  | { ok: false; error: string }

export function getCustomerOrgId(session: Session): string {
  if (session.user.role !== UserRole.CUSTOMER_USER) {
    throw new Error(
      "getCustomerOrgId called for a non-customer session — layout gate drifted",
    )
  }
  return session.user.organizationId
}

export async function requireCustomerOrg(): Promise<CustomerOrgCheck> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (session.user.role !== UserRole.CUSTOMER_USER) {
    return { ok: false, error: "Your role can't perform this action" }
  }
  return {
    ok: true,
    session,
    organizationId: session.user.organizationId,
  }
}
