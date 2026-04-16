/**
 * Prisma client singleton.
 *
 * Prisma 7 requires a driver adapter — we use `@prisma/adapter-pg` against
 * DATABASE_URL (Session pooler in MVP, Transaction pooler at deploy). In
 * dev, Next's module reloading would otherwise instantiate a new client
 * per request and exhaust the pooler, so we cache on globalThis.
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/prisma/generated/client"

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined
}

function makeClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({ adapter })
}

export const db: PrismaClient = globalThis.__prisma__ ?? makeClient()

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = db
}
