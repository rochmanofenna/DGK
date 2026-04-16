import type { DeliveryOrderStatus } from "@/prisma/generated/enums"

/**
 * DO status state machine — single source of truth for both the render
 * layer ("which action buttons to show") and server actions ("is this
 * transition legal"). If the rules ever drift between render and action,
 * one of the two is wrong. Keep them reading from here.
 *
 * Terminal states (DELIVERED, CANCELLED) have no outgoing transitions.
 * DISPATCHED → DELIVERED is intentionally NOT a user-button transition:
 * DELIVERED is only reachable via POD verification (see actions.ts).
 * That invariant keeps anyone from marking a delivery complete without
 * a POD on file.
 */

export const DO_TRANSITIONS: Record<
  DeliveryOrderStatus,
  readonly DeliveryOrderStatus[]
> = {
  PENDING: ["ACKNOWLEDGED", "CANCELLED"],
  ACKNOWLEDGED: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
}

export function canTransition(
  from: DeliveryOrderStatus,
  to: DeliveryOrderStatus,
): boolean {
  return DO_TRANSITIONS[from].includes(to)
}

export interface StatusButton {
  label: string
  to: DeliveryOrderStatus
}

/**
 * User-facing "advance status" buttons per current state. CANCELLED is a
 * separate action surface (destructive; confirm dialog), so it's not in
 * this list even though it's a legal transition.
 */
export const STATUS_BUTTONS: Record<DeliveryOrderStatus, StatusButton[]> = {
  PENDING: [{ label: "Mark acknowledged", to: "ACKNOWLEDGED" }],
  ACKNOWLEDGED: [{ label: "Mark dispatched", to: "DISPATCHED" }],
  DISPATCHED: [],
  DELIVERED: [],
  CANCELLED: [],
}
