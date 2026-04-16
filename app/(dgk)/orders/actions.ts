"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { nextDONumber, nextOrderNumber } from "@/lib/numbering"
import { OrderStatus, UserRole } from "@/prisma/generated/enums"

import {
  assignVendorSchema,
  orderFormSchema,
  type AssignVendorValues,
  type OrderFormValues,
} from "./schemas"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ORDER_CREATE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]
const ORDER_CANCEL_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]
const ASSIGN_VENDOR_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]

/** True iff `err` is a Prisma P2002 unique-constraint violation on `orderNumber`. */
function isOrderNumberConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== "P2002") return false
  const target = e.meta?.target
  return Array.isArray(target) && target.length === 1 && target[0] === "orderNumber"
}

/** True iff `err` is a Prisma P2002 unique-constraint violation on `doNumber`. */
function isDONumberConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== "P2002") return false
  const target = e.meta?.target
  return Array.isArray(target) && target.length === 1 && target[0] === "doNumber"
}

export async function createOrderAction(
  input: OrderFormValues,
): Promise<ActionResult<{ orderId: string }>> {
  // Zod re-validation — never trust the client parse.
  const parsed = orderFormSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  // Auth + role gate.
  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (!ORDER_CREATE_ROLES.includes(session.user.role)) {
    return { ok: false, error: "Your role can't create orders" }
  }

  // Business rules the schema already expresses but the server re-checks
  // so a raw action call can't bypass the zod refine.
  if (data.originRegion === data.destinationRegion) {
    return { ok: false, error: "Origin and destination must differ" }
  }

  // Customer must exist — don't trust the ID shape alone.
  const customer = await db.customer.findUnique({
    where: { id: data.customerId },
    select: { id: true },
  })
  if (!customer) return { ok: false, error: "Customer not found" }

  // Optimistic create with retry on orderNumber collision only.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const orderNumber = await nextOrderNumber()
      const created = await db.order.create({
        data: {
          orderNumber,
          customerId: data.customerId,
          createdById: session.user.id,
          status: OrderStatus.SUBMITTED,
          pickupDate: data.pickupDate,
          packingList: data.packingList,
          manifestDescription: data.manifestDescription,
          requiredTruckType: data.requiredTruckType,
          originRegion: data.originRegion,
          destinationRegion: data.destinationRegion,
          originAddress: data.originAddress,
          destinationAddress: data.destinationAddress,
          customerPriceIDR: data.customerPriceIDR,
          notes: data.notes ?? null,
        },
        select: { id: true },
      })

      revalidatePath("/orders")
      return { ok: true, data: { orderId: created.id } }
    } catch (err) {
      lastError = err
      if (isOrderNumberConflict(err)) continue
      throw err
    }
  }

  // All retries hit an orderNumber collision — extremely unlikely in
  // practice; surface as a clean error rather than crash.
  throw lastError
}

export async function cancelOrderAction(
  orderId: string,
): Promise<ActionResult> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (!ORDER_CANCEL_ROLES.includes(session.user.role)) {
    return { ok: false, error: "Your role can't cancel orders" }
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  })
  if (!order) return { ok: false, error: "Order not found" }

  // MVP: only SUBMITTED orders are cancellable from the detail page. Later
  // modules will widen this to in-progress states with vendor notification.
  if (order.status !== OrderStatus.SUBMITTED) {
    return { ok: false, error: `Cannot cancel an order in status ${order.status}` }
  }

  await db.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  })

  revalidatePath("/orders")
  revalidatePath(`/orders/${orderId}`)
  return { ok: true, data: undefined }
}

/**
 * Assigns a vendor to a SUBMITTED order by creating a DeliveryOrder with
 * a frozen price snapshot and flipping Order.status → ASSIGNED, atomically.
 *
 * Input is `rateCardEntryId` (not `vendorId`) so the price the user saw
 * on screen is pinned: if the rate card changes between dialog open and
 * confirm, the re-validation catches it and returns a clean error rather
 * than silently charging against the new card.
 */
export async function createDeliveryOrderAction(
  input: AssignVendorValues,
): Promise<ActionResult<{ deliveryOrderId: string }>> {
  const parsed = assignVendorSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { orderId, rateCardEntryId } = parsed.data

  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (!ASSIGN_VENDOR_ROLES.includes(session.user.role)) {
    return { ok: false, error: "Your role can't assign vendors" }
  }

  // Re-load + re-validate server-side. The dialog passed an entry ID; we
  // verify it still covers this order's route and the rate card is still
  // active. Never trust the form.
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      originRegion: true,
      destinationRegion: true,
      requiredTruckType: true,
    },
  })
  if (!order) return { ok: false, error: "Order not found" }
  if (order.status !== OrderStatus.SUBMITTED) {
    return { ok: false, error: `Order is already ${order.status.toLowerCase()}` }
  }

  const entry = await db.rateCardEntry.findUnique({
    where: { id: rateCardEntryId },
    include: { rateCard: { include: { vendor: true } } },
  })
  if (!entry) return { ok: false, error: "Rate card entry not found" }

  if (
    entry.originRegion !== order.originRegion ||
    entry.destinationRegion !== order.destinationRegion ||
    entry.truckType !== order.requiredTruckType
  ) {
    return { ok: false, error: "Rate card no longer covers this route" }
  }

  const now = new Date()
  if (entry.rateCard.effectiveDate > now) {
    return { ok: false, error: "Rate card is not yet effective" }
  }
  if (entry.rateCard.expiryDate && entry.rateCard.expiryDate <= now) {
    return { ok: false, error: "Rate card has expired" }
  }
  if (!entry.rateCard.vendor.isActive) {
    return { ok: false, error: "Vendor is inactive" }
  }

  // DO create + Order status flip run in a single transaction so we can't
  // leave an order ASSIGNED without a DO, or a DO pointing at a SUBMITTED
  // order. Retry on `doNumber` P2002 only — narrow predicate so an
  // unrelated unique-constraint violation doesn't silently burn retries.
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doNumber = await nextDONumber()
      const created = await db.$transaction(async (tx) => {
        const deliveryOrder = await tx.deliveryOrder.create({
          data: {
            doNumber,
            orderId: order.id,
            vendorId: entry.rateCard.vendorId,
            assignedById: session.user.id,
            // Frozen: copied at assignment time so rate-card edits can never
            // mutate historical DOs. Never replace with a FK lookup.
            vendorPriceIDR: entry.priceIDR,
          },
          select: { id: true },
        })
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.ASSIGNED },
        })
        return deliveryOrder
      })

      revalidatePath(`/orders/${order.id}`)
      revalidatePath("/deliveries")
      return { ok: true, data: { deliveryOrderId: created.id } }
    } catch (err) {
      lastError = err
      if (isDONumberConflict(err)) continue
      throw err
    }
  }
  throw lastError
}
