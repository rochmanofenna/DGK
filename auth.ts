import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"

import { authConfig } from "./auth.config"
import { db } from "@/lib/db"

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // TODO(phase-2): rate limit authorize() — 5 attempts per IP per 15 min
      // before this runs. Right now a determined attacker can pin a real
      // email and brute-force passwords via repeated POSTs to the sign-in
      // endpoint. Simple in-memory counter keyed by IP will close it.
      async authorize(rawCreds) {
        const parsed = credentialsSchema.safeParse(rawCreds)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const user = await db.user.findUnique({ where: { email } })
        if (!user) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

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
