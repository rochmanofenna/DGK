import type { Session } from "next-auth"

import { auth } from "@/auth"
import type { UserRole } from "@/prisma/generated/enums"

export type RoleCheckResult =
  | { ok: true; session: Session }
  | { ok: false; error: string }

/**
 * Gate a Server Action on signed-in + role membership. Returns a
 * discriminated union the caller can pass through as-is when the action
 * returns `ActionResult<T>` (same `{ ok: false, error }` shape) — two
 * concrete uses made the shape obvious; factoring any further would
 * over-reach (bodies of the actions genuinely differ).
 */
export async function requireRole(
  roles: UserRole[],
  errorMessage?: string,
): Promise<RoleCheckResult> {
  const session = await auth()
  if (!session) return { ok: false, error: "Not signed in" }
  if (!roles.includes(session.user.role)) {
    return {
      ok: false,
      error: errorMessage ?? "Your role can't perform this action",
    }
  }
  return { ok: true, session }
}
