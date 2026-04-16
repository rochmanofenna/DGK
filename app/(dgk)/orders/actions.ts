"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { nextOrderNumber } from "@/lib/numbering"
import { OrderStatus, UserRole } from "@/prisma/generated/enums"

import { orderFormSchema, type OrderFormValues } from "./schemas"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const ORDER_CREATE_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]
const ORDER_CANCEL_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]

/** True iff `err` is a Prisma P2002 unique-constraint violation on `orderNumber`. */
function isOrderNumberConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== "P2002") return false
  const target = e.meta?.target
  return Array.isArray(target) && target.length === 1 && target[0] === "orderNumber"
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
