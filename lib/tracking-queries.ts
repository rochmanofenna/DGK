import { db } from "@/lib/db"
import {
  MAX_TRACKING_ACCURACY_METERS,
  TRACKING_TRAIL_LIMIT,
} from "@/lib/tracking"
import { DeliveryOrderStatus } from "@/prisma/generated/enums"

/**
 * Fetches the latest usable pin and an optional trail for one DO.
 *
 * "Usable" = accuracy is absent or ≤ MAX_TRACKING_ACCURACY_METERS.
 * Noisy rows are kept in the DB (the ingest endpoint accepts them) so
 * the trail is complete; filtering happens here, at read time, so the
 * definition of "too noisy" can evolve without a backfill.
 *
 * `withTrail=false` skips the breadcrumb query — the customer surface
 * shows the pin only, so it doesn't need the extra N rows.
 */
export interface TrackingSnapshot {
  pin: {
    latitude: number
    longitude: number
    recordedAt: Date
    accuracyMeters: number | null
  } | null
  trail: Array<{ latitude: number; longitude: number }>
}

export async function getTrackingSnapshot(
  deliveryOrderId: string,
  options: { withTrail: boolean },
): Promise<TrackingSnapshot> {
  const pinRow = await db.locationUpdate.findFirst({
    where: {
      deliveryOrderId,
      OR: [
        { accuracyMeters: null },
        { accuracyMeters: { lte: MAX_TRACKING_ACCURACY_METERS } },
      ],
    },
    orderBy: { recordedAt: "desc" },
    select: {
      latitude: true,
      longitude: true,
      recordedAt: true,
      accuracyMeters: true,
    },
  })

  if (!options.withTrail || !pinRow) {
    return { pin: pinRow ?? null, trail: [] }
  }

  // Newest-first on the read, then reverse so the polyline draws in
  // time order. Leaflet doesn't care about order, but humans reading
  // JSON in devtools do.
  const newest = await db.locationUpdate.findMany({
    where: {
      deliveryOrderId,
      OR: [
        { accuracyMeters: null },
        { accuracyMeters: { lte: MAX_TRACKING_ACCURACY_METERS } },
      ],
    },
    orderBy: { recordedAt: "desc" },
    take: TRACKING_TRAIL_LIMIT,
    select: { latitude: true, longitude: true },
  })

  return {
    pin: pinRow,
    trail: newest.slice().reverse(),
  }
}

/** Tracking is only meaningful (to the renderer) while the trip is active. */
export function isTrackableStatus(status: DeliveryOrderStatus): boolean {
  return (
    status === DeliveryOrderStatus.DISPATCHED ||
    status === DeliveryOrderStatus.DELIVERED
  )
}
