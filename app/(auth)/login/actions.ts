"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/auth"

export interface LoginState {
  error: string | null
}

/**
 * Server action bound to the login form. Delegates to NextAuth's
 * `signIn`, which either:
 *   - succeeds and throws a NEXT_REDIRECT (caught by Next to execute the
 *     navigation to `redirectTo`),
 *   - or throws AuthError / CredentialsSignin — we convert that to state
 *     so the form re-renders with an inline error.
 * Non-auth errors are re-thrown so NEXT_REDIRECT and genuine failures
 * surface to the framework / error boundary.
 */
export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const redirectTo = (formData.get("callbackUrl") as string) || "/dashboard"
  // Narrow the form-provided portal field. Anything other than the three
  // known values is treated as "employee" — the authorize() callback will
  // reject a mismatch either way, so this is just belt-and-suspenders.
  const portalRaw = formData.get("portal")
  const portal =
    portalRaw === "client" || portalRaw === "carrier" ? portalRaw : "employee"

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      portal,
      redirectTo,
    })
    // Unreachable: a successful signIn throws NEXT_REDIRECT.
    return { error: null }
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "CredentialsSignin" }
    }
    throw err
  }
}
