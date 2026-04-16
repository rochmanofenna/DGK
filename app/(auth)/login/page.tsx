import { redirect } from "next/navigation"

import { auth } from "@/auth"

import { LoginForm } from "./login-form"

interface LoginPageProps {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}

/**
 * Only allow same-origin relative paths as `callbackUrl`. A leading `//`
 * would be a protocol-relative URL (→ open-redirect), so we reject
 * anything not starting with exactly one `/`.
 */
function sanitizeCallback(url: string | undefined): string {
  if (!url) return "/dashboard"
  if (!url.startsWith("/")) return "/dashboard"
  if (url.startsWith("//")) return "/dashboard"
  return url
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const callbackUrl = sanitizeCallback(params.callbackUrl)

  const session = await auth()
  if (session) redirect(callbackUrl)

  return (
    <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
      {/* Editorial hairline frame — visible on wider viewports only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-8 hidden rounded-sm border border-border/40 lg:block"
      />

      {/* Corner label — small typographic flourish */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-10 top-10 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 lg:block"
      >
        No. 2026 / 001
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 bottom-10 hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 lg:block"
      >
        Jakarta · Indonesia
      </div>

      <div className="w-full max-w-[380px]">
        {/* Wordmark */}
        <div className="mb-10 text-center">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            PT Dinamika Global Korpora
          </p>
          <h1 className="font-display text-[5.5rem] italic leading-[0.85] tracking-[-0.03em] text-foreground">
            DGK
          </h1>
          <div className="mx-auto mt-6 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-foreground/35" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              ERP
            </span>
            <span className="h-px w-8 bg-foreground/35" aria-hidden />
          </div>
          <p className="mt-5 text-[13px] text-muted-foreground">
            Logistics operations, end-to-end.
          </p>
        </div>

        {/* Form card */}
        <div className="rounded-sm bg-card p-7 ring-1 ring-border/80 shadow-[0_1px_0_0_rgba(30,22,15,0.02)]">
          <div className="mb-6 flex items-baseline justify-between border-b border-border/80 pb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Sign in
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              v0.1 · MVP
            </p>
          </div>
          <LoginForm callbackUrl={callbackUrl} initialError={params.error} />
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Internal use · Authorized personnel only
        </p>
      </div>
    </div>
  )
}
