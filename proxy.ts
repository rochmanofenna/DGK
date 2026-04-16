/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`. The function is Node
 * runtime (not Edge) in 16.x; Vercel docs promise edge as an option in a
 * later release. We keep the edge-safe config split so that flip is free
 * when it happens.
 *
 * The `authorized` callback in `auth.config.ts` decides redirect vs
 * passthrough; this file just wires auth() into the proxy-convention and
 * declares the matcher.
 */

import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

// Next 16's proxy analyzer requires an explicit function export named
// `proxy` (or default). A destructured `{ auth: proxy }` const isn't
// recognized at build time — so we take the NextAuth handler and
// re-export it as a default function.
const { auth } = NextAuth(authConfig)
export default auth

export const config = {
  // Protect everything except static assets, Next internals, /login, and
  // NextAuth's own /api/auth/* route handlers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)"],
}
