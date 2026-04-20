import type { Session } from "next-auth"

import { auth } from "@/auth"
import { UserRole } from "@/prisma/generated/enums"

/**
 * Vendor-portal multi-tenant guard. `session.user.organizationId` for a
 * VENDOR_USER is the vendor's Organization id — the `Vendor.organizationId`
 * unique FK is what we join against when scoping DO / invoice queries.
 *
 * Mirrors `lib/customer-guard.ts` deliberately; the two shapes are the
 * same so a future extraction (once a third tenant-scoped portal exists)
 * can pattern-match without special-casing.
 *
 * `getVendorOrgId` — sync; throws if a non-vendor session is handed in.
 * Use inside page Server Components the (vendor) layout has already
 * gated. The throw is defence-in-depth against layout drift.
 *
 * `requireVendorOrg` — async; returns a discriminated union so Server
 * Actions can pattern-match and return user-facing errors rather than
 * leaking exception strings.
 */
export type VendorOrgCheck =
  | { ok: true; session: Session; organizationId: string }
  | { ok: false; error: string }

export function getVendorOrgId(session: Session): string {
  if (session.user.role !== UserRole.VENDOR_USER) {
    throw new Error(
      "getVendorOrgId called for a non-vendor session — layout gate drifted",
    )
  }
  return session.user.organizationId
}

export async function requireVendorOrg(): Promise<VendorOrgCheck> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (session.user.role !== UserRole.VENDOR_USER) {
    return { ok: false, error: "Your role can't perform this action" }
  }
  return {
    ok: true,
    session,
    organizationId: session.user.organizationId,
  }
}
