import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { DeliveryOrderStatus, UserRole } from "@/prisma/generated/enums"

/**
 * Courier GPS ingest.
 *
 * Contract:
 *   POST /api/tracking/location
 *   Authorization: cookie-based session (VENDOR_USER only)
 *   Body: { deliveryOrderId, latitude, longitude, accuracyMeters?,
 *           headingDegrees?, speedMps?, recordedAt? (ISO-8601) }
 *   Response: 204 on success. 4xx on validation / auth / rate-limit.
 *
 * Design notes:
 *   - Writes only accepted while DO is DISPATCHED. PENDING / ACKNOWLEDGED
 *     are too early (no trip yet); DELIVERED / CANCELLED are terminal
 *     (stale phones kept in pockets are a common source of accidental
 *     writes, and we don't want them polluting the trail).
 *   - Rate limit: 1 write per DO per 10s. Enforced in-memory (Map).
 *     TODO(phase-3): move to Redis / Upstash before horizontal scale —
 *     on Vercel, cold starts reset the Map and two serverless instances
 *     each have their own, so the 10s floor is best-effort only. For
 *     MVP with a single vendor + low traffic this is acceptable.
 *   - Accuracy filtering is deliberately deferred to read time
 *     (lib/tracking.ts MAX_TRACKING_ACCURACY_METERS) so a noisy fix we
 *     reject now doesn't become a gap that confuses the trail later.
 */

const bodySchema = z.object({
  deliveryOrderId: z.string().min(1),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracyMeters: z.number().nonnegative().finite().optional(),
  headingDegrees: z.number().gte(0).lt(360).optional(),
  speedMps: z.number().gte(0).finite().optional(),
  recordedAt: z.iso.datetime({ offset: true }).optional(),
})

const RATE_LIMIT_WINDOW_MS = 10_000
const lastWriteByDo = new Map<string, number>()

function hitRateLimit(deliveryOrderId: string, now: number): boolean {
  const last = lastWriteByDo.get(deliveryOrderId)
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) return true
  lastWriteByDo.set(deliveryOrderId, now)
  return false
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }
  if (session.user.role !== UserRole.VENDOR_USER) {
    return NextResponse.json(
      { error: "Only couriers can post location updates" },
      { status: 403 },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const body = parsed.data

  // Tenancy + status check in one hop. A DO id the vendor doesn't own
  // returns 404 — same shape as genuinely unknown, so we don't confirm
  // existence to a caller who shouldn't know.
  const deliveryOrder = await db.deliveryOrder.findFirst({
    where: {
      id: body.deliveryOrderId,
      vendor: { organizationId: session.user.organizationId },
    },
    select: { id: true, status: true },
  })
  if (!deliveryOrder) {
    return NextResponse.json(
      { error: "Delivery order not found" },
      { status: 404 },
    )
  }
  if (deliveryOrder.status !== DeliveryOrderStatus.DISPATCHED) {
    return NextResponse.json(
      {
        error: `Cannot post location for a ${deliveryOrder.status.toLowerCase()} delivery`,
      },
      { status: 409 },
    )
  }

  const now = Date.now()
  if (hitRateLimit(deliveryOrder.id, now)) {
    return NextResponse.json(
      { error: "Rate limit: one write per 10 seconds" },
      { status: 429 },
    )
  }

  const recordedAt = body.recordedAt ? new Date(body.recordedAt) : new Date(now)

  await db.locationUpdate.create({
    data: {
      deliveryOrderId: deliveryOrder.id,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters ?? null,
      headingDegrees: body.headingDegrees ?? null,
      speedMps: body.speedMps ?? null,
      recordedAt,
    },
  })

  return new Response(null, { status: 204 })
}
