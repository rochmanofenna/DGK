/**
 * Mount NextAuth's built-in route handlers at /api/auth/*.
 * This serves /api/auth/csrf, /api/auth/session, /api/auth/callback/*,
 * /api/auth/signout, and the other framework endpoints that signIn/
 * signOut talk to internally.
 */
import { handlers } from "@/auth"
export const { GET, POST } = handlers
