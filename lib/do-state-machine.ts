import { UserRole } from "@/prisma/generated/enums"
import type { DeliveryOrderStatus } from "@/prisma/generated/enums"

/**
 * DO status state machine — single source of truth for:
 *   - legal transitions (validation in server actions)
 *   - role-gating (who can perform each transition)
 *   - render-layer button selection (which actions to offer per role)
 *
 * The vendor-driven path is the default; DGK OPS/ADMIN are included as a
 * "manual override" so an absent or unresponsive vendor never blocks the
 * customer-facing pipeline. Audit trail (who actually performed each
 * transition) is a phase-3 follow-up — see TODO in actions.ts.
 *
 * Terminal states (DELIVERED, CANCELLED) have no outgoing transitions.
 * DISPATCHED → DELIVERED is intentionally NOT a user-button transition:
 * DELIVERED is only reachable via POD verification (see actions.ts).
 * That invariant keeps anyone from marking a delivery complete without
 * a POD on file.
 */

/** Who can move DOs forward — vendor-driven, with DGK ops as override. */
const VENDOR_OR_DGK_OPS: readonly UserRole[] = [
  UserRole.VENDOR_USER,
  UserRole.OPS_MANAGER,
  UserRole.ADMIN,
]

/** Cancellation is DGK-only — a vendor refusing a DO reaches out to DGK,
 * they don't cancel from the carrier portal. FINANCE_ADMIN is excluded
 * because finance operates on invoices, not on operational status. */
const DGK_OPS_ONLY: readonly UserRole[] = [
  UserRole.OPS_MANAGER,
  UserRole.ADMIN,
]

export interface DoTransition {
  to: DeliveryOrderStatus
  label: string
  allowedRoles: readonly UserRole[]
}

export const DO_TRANSITIONS: Record<
  DeliveryOrderStatus,
  readonly DoTransition[]
> = {
  PENDING: [
    { to: "ACKNOWLEDGED", label: "Mark acknowledged", allowedRoles: VENDOR_OR_DGK_OPS },
    { to: "CANCELLED",    label: "Cancel",            allowedRoles: DGK_OPS_ONLY },
  ],
  ACKNOWLEDGED: [
    { to: "DISPATCHED", label: "Mark dispatched", allowedRoles: VENDOR_OR_DGK_OPS },
    { to: "CANCELLED",  label: "Cancel",          allowedRoles: DGK_OPS_ONLY },
  ],
  DISPATCHED: [
    { to: "CANCELLED", label: "Cancel", allowedRoles: DGK_OPS_ONLY },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

/** Role-agnostic: is this transition legal at all? */
export function canTransition(
  from: DeliveryOrderStatus,
  to: DeliveryOrderStatus,
): boolean {
  return DO_TRANSITIONS[from].some((t) => t.to === to)
}

/** Role-aware: can THIS role perform this transition? Use in server actions
 * — the source of truth for authorization, because clients lie. */
export function canTransitionAsRole(
  from: DeliveryOrderStatus,
  to: DeliveryOrderStatus,
  role: UserRole,
): boolean {
  const transition = DO_TRANSITIONS[from].find((t) => t.to === to)
  return !!transition && transition.allowedRoles.includes(role)
}

/**
 * Transitions a given role can perform from the current state, filtered
 * for button rendering: CANCELLED is legal but doesn't belong in the
 * main action row — it's a destructive action with a confirm dialog
 * surface, handled elsewhere. If you ever need the full list including
 * cancel, iterate `DO_TRANSITIONS[from]` directly.
 */
export function transitionsForRole(
  from: DeliveryOrderStatus,
  role: UserRole,
): readonly DoTransition[] {
  return DO_TRANSITIONS[from].filter(
    (t) => t.to !== "CANCELLED" && t.allowedRoles.includes(role),
  )
}
