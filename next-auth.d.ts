import type { DefaultSession } from "next-auth"
import type { UserRole } from "@/prisma/generated/client"

/**
 * Module augmentations so session.user.role / id / organizationId are
 * strongly typed across the app without casts at each usage site.
 */

declare module "next-auth" {
  /** Return shape of Credentials.authorize() — becomes `user` in the jwt callback. */
  interface User {
    id: string
    role: UserRole
    organizationId: string
  }

  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    organizationId: string
  }
}
