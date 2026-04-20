"use server"

import { revalidatePath } from "next/cache"

import { requireCustomerOrg } from "@/lib/customer-guard"
import { db } from "@/lib/db"
import { nextOrderNumber } from "@/lib/numbering"
import { OrderStatus } from "@/prisma/generated/enums"

import type { ActionResult } from "@/app/(dgk)/orders/actions"

import {
  customerOrderSubmissionSchema,
  type CustomerOrderSubmissionValues,
} from "./schema"

/** True iff `err` is a Prisma P2002 unique-constraint violation on `orderNumber`. */
function isOrderNumberConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== "P2002") return false
  const target = e.meta?.target
  return (
    Array.isArray(target) && target.length === 1 && target[0] === "orderNumber"
  )
}

/**
 * Customer-submitted shipping request.
 *
 * Differs from `createOrderAction` (DGK-side) in three ways:
 *
 *   1. Gate is `requireCustomerOrg`, not `requireRole(OPS/ADMIN)` —
 *      anything else is a tenancy violation.
 *   2. `customerId` is resolved server-side from the session's
 *      organization; the client never supplies it.
 *   3. Status is `DRAFT` with `customerPriceIDR = null`. DGK reviews,
 *      sets the price, then advances to SUBMITTED (handled in 2c).
 *
 * TODO(phase-2): once the DGK review flow is real, notify DGK on
 * submission (email / in-app) so drafts don't sit unseen.
 */
export async function submitCustomerOrderAction(
  input: CustomerOrderSubmissionValues,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = customerOrderSubmissionSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }
  const data = parsed.data

  const gate = await requireCustomerOrg()
  if (!gate.ok) return gate
  const { session, organizationId } = gate

  if (data.originRegion === data.destinationRegion) {
    return { ok: false, error: "Origin and destination must differ" }
  }

  // Customer:Organization is 1:1 — look up by org to find the
  // Customer row. If a CUSTOMER_USER's org has no Customer row,
  // submissions can't be attached; surface a clear error.
  const customer = await db.customer.findUnique({
    where: { organizationId },
    select: { id: true },
  })
  if (!customer) {
    return {
      ok: false,
      error:
        "Your account isn't linked to a customer record yet. Contact DGK support.",
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const orderNumber = await nextOrderNumber()
      const created = await db.order.create({
        data: {
          orderNumber,
          customerId: customer.id,
          createdById: session.user.id,
          status: OrderStatus.DRAFT,
          pickupDate: data.pickupDate,
          packingList: data.packingList,
          manifestDescription: data.manifestDescription,
          requiredTruckType: data.requiredTruckType,
          originRegion: data.originRegion,
          destinationRegion: data.destinationRegion,
          originAddress: data.originAddress,
          destinationAddress: data.destinationAddress,
          // Null until DGK reviews and sets the agreed price. Downstream
          // pricing code already tolerates null (see invoice generation).
          customerPriceIDR: null,
          notes: data.notes ?? null,
        },
        select: { id: true },
      })

      revalidatePath("/portal/orders")
      revalidatePath("/portal")
      // Revalidate the DGK-side list too — DGK reviewers see the new
      // DRAFT without a manual refresh.
      revalidatePath("/orders")
      return { ok: true, data: { orderId: created.id } }
    } catch (err) {
      lastError = err
      if (isOrderNumberConflict(err)) continue
      throw err
    }
  }

  throw lastError
}
