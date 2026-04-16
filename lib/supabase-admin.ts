import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase admin client. Uses the service role key, which
 * bypasses ALL Row-Level Security. MUST NEVER be imported from a Client
 * Component — the `import "server-only"` above makes that a build error
 * rather than a runtime secret-leak.
 *
 * Currently used for: POD photo uploads (server actions write to the
 * dgk-erp bucket). The bucket is public-read so the returned object
 * URLs work in both the app and later invoice PDFs; INSERT / UPDATE /
 * DELETE are deny-by-default for anon and authenticated roles, so only
 * this client can write.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Fail loudly at module load on the server rather than producing a
  // half-configured client that silently 401s on every upload.
  throw new Error(
    "lib/supabase-admin: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
  )
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const POD_BUCKET = "kampono_bucket"
export const POD_FOLDER = "pod-photos"
