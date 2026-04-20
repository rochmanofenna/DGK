import type { NextAuthConfig } from "next-auth"
import { NextResponse } from "next/server"

import { UserRole } from "@/prisma/generated/enums"

/**
 * Runtime-agnostic subset of the NextAuth config, safe for `proxy.ts` to
 * import (Next 16 proxy is Node-runtime in 16.x but the split is kept so
 * we stay drop-in compatible if edge returns in a later Next release).
 *
 * The Credentials provider — which needs Prisma + bcryptjs — lives in
 * `auth.ts` and is spread on top of this.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId
      }
      return token
    },
    // TODO(v5-stable): retry without the casts below — the module
    // augmentation in next-auth.d.ts should flow through callback
    // inference on stable v5. Under beta.31 it doesn't; token.id / .role /
    // .organizationId come through as `unknown` despite the augmentation.
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as typeof session.user.role
        session.user.organizationId = token.organizationId as string
      }
      return session
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      // /login is always reachable; everything else needs a session.
      // Proxy's matcher already excludes static assets + /api/auth.
      if (pathname.startsWith("/login")) return true
      if (!auth) return false

      // Role-aware routing. Customer sessions may only see `/portal/*`;
      // DGK sessions may only see the DGK surface. Single source of
      // truth — layout gates are still there as a second line.
      const isCustomer = auth.user.role === UserRole.CUSTOMER_USER
      const isPortal = pathname.startsWith("/portal")
      if (isCustomer && !isPortal) {
        return NextResponse.redirect(new URL("/portal", request.url))
      }
      if (!isCustomer && isPortal) {
        return NextResponse.redirect(new URL("/dashboard", request.url))
      }
      return true
    },
  },
} satisfies NextAuthConfig
