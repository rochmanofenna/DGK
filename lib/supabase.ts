/**
 * Supabase client factories for the DGK ERP.
 *
 * Auth is handled by NextAuth v5; Supabase here is Storage-only (POD photos,
 * invoice PDFs, permission docs). The @supabase/ssr cookie plumbing is kept
 * in place so adopting Supabase Auth later would be a small change rather
 * than a rewrite.
 */

import { createBrowserClient, createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/** Browser (Client Component) — import inside `"use client"` modules only. */
export function getBrowserSupabase() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
}

/** Server (Server Component / Route Handler / Server Action). */
export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies; safe to ignore. Cookie
          // writes land from middleware / Route Handlers / Server Actions.
        }
      },
    },
  })
}
