/**
 * Rate-card lookup used by the vendor-assignment flow.
 *
 * Returns vendors whose **active** rate card contains an entry matching
 * the order's (originRegion, destinationRegion, requiredTruckType) tuple.
 * "Active" = effectiveDate ≤ now AND (expiryDate is null OR > now) AND
 * vendor.isActive.
 *
 * Rollover rule (see docs/DECISIONS.md): if one vendor has multiple
 * active rate cards covering the same route, return the entry from the
 * card with the latest effectiveDate.
 */

import { db } from "@/lib/db"
import type { Region, TruckType } from "@/prisma/generated/enums"

export interface VendorCandidate {
  rateCardEntryId: string
  vendorId: string
  vendorName: string
  priceIDR: number
  effectiveDate: Date
}

export async function findVendorCandidatesForOrder(order: {
  originRegion: Region
  destinationRegion: Region
  requiredTruckType: TruckType
}): Promise<VendorCandidate[]> {
  const now = new Date()

  const entries = await db.rateCardEntry.findMany({
    where: {
      originRegion: order.originRegion,
      destinationRegion: order.destinationRegion,
      truckType: order.requiredTruckType,
      rateCard: {
        effectiveDate: { lte: now },
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
        vendor: { isActive: true },
      },
    },
    include: {
      rateCard: {
        include: {
          vendor: {
            include: { organization: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: { rateCard: { effectiveDate: "desc" } },
  })

  // Rate-card rollover dedupe: for a given vendor, first-seen wins (which
  // is the entry from the latest-effectiveDate card because of the orderBy).
  const byVendor = new Map<string, (typeof entries)[number]>()
  for (const entry of entries) {
    if (!byVendor.has(entry.rateCard.vendorId)) {
      byVendor.set(entry.rateCard.vendorId, entry)
    }
  }

  return [...byVendor.values()].map((entry) => ({
    rateCardEntryId: entry.id,
    vendorId: entry.rateCard.vendorId,
    vendorName: entry.rateCard.vendor.organization.name,
    priceIDR: entry.priceIDR,
    effectiveDate: entry.rateCard.effectiveDate,
  }))
}
