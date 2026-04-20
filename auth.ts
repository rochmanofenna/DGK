import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { authConfig } from "./auth.config"
import { db } from "@/lib/db"
import { UserRole } from "@/prisma/generated/enums"

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  // Which login card the submission came from. The two cards on /login look
  // identical to the server, so without this we'd accept an employee's
  // credentials through the Client card (and vice-versa) — a real footgun
  // since the post-auth redirect would then punt the user to the wrong
  // portal for a split second before the layout gate intervened.
  portal: z.enum(["employee", "client"]),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        portal: { label: "Portal", type: "text" },
      },
      // TODO(phase-2): rate limit authorize() — 5 attempts per IP per 15 min
      // before this runs. Right now a determined attacker can pin a real
      // email and brute-force passwords via repeated POSTs to the sign-in
      // endpoint. Simple in-memory counter keyed by IP will close it.
      async authorize(rawCreds) {
        const parsed = credentialsSchema.safeParse(rawCreds)
        if (!parsed.success) return null

        const { email, password, portal } = parsed.data
        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        // Enforce that the login card matches the user's role. Return the
        // same `null` as a bad password so the UI surface is identical —
        // we don't want to leak "this email exists but through the other
        // portal", which would let an attacker enumerate DGK staff by
        // poking the Client card.
        const isCustomer = user.role === UserRole.CUSTOMER_USER
        if (portal === "client" && !isCustomer) return null
        if (portal === "employee" && isCustomer) return null

        // The return value becomes the `user` arg to the jwt callback and
        // is persisted in the JWT for the session's lifetime.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
  ],
})
