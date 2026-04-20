import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DGKLogo } from "@/components/brand/dgk-logo"

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
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6 py-16">
      {/* Thin brand-red rule across the very top — subtle corporate touch */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-[var(--brand-red)]"
      />

      {/* Wider container so two cards fit side by side on desktop. Kept
       * narrow enough that the cards don't drift apart into "lost in a
       * field" territory. */}
      <div className="w-full max-w-[880px]">
        {/* Logo lockup — kept in the same soft-brand-framed card so the
         * visual identity up top is unchanged; just recentered above the
         * dual-card row. */}
        <div
          className="brand-rise mb-10 flex justify-center"
          style={{ animationDelay: "60ms" }}
        >
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <DGKLogo
              width={320}
              priority
              className="block h-auto max-w-full"
            />
          </div>
        </div>

        {/* Two sign-in cards. Grid collapses to a single column under
         * md (<768px), Employee on top (as requested) by DOM order.
         * Both forms post to the exact same `signInAction` — NextAuth's
         * `authorized` callback handles role → portal routing after auth,
         * so the only difference between the cards is the label + accent. */}
        <div className="grid gap-6 md:grid-cols-2">
          <div
            className="brand-rise rounded-lg border border-border bg-card p-8 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.08)]"
            style={{ animationDelay: "180ms" }}
          >
            <div className="mb-6 border-b border-border pb-4">
              <div className="flex items-baseline justify-between">
                <h1 className="text-sm font-semibold text-foreground">
                  Employee login
                </h1>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  v0.1 · MVP
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                DGK internal operations
              </p>
            </div>
            <LoginForm
              callbackUrl={callbackUrl}
              initialError={params.error}
              variant="employee"
              autoFocus
            />
          </div>

          <div
            className="brand-rise rounded-lg border border-border bg-card p-8 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.08)]"
            style={{ animationDelay: "240ms" }}
          >
            <div className="mb-6 border-b border-border pb-4">
              <h1 className="text-sm font-semibold text-foreground">
                Client login
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Track shipments &amp; invoices
              </p>
            </div>
            {/* `initialError` intentionally only wired to the Employee card —
                the `?error=` query param can't tell us which card the user
                submitted, and showing the same error on both reads as
                "something's broken here too." Post-submit errors come
                through `useActionState` per-form, which is correct. */}
            <LoginForm callbackUrl={callbackUrl} variant="client" />
          </div>
        </div>

        <p
          className="brand-rise mt-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ animationDelay: "300ms" }}
        >
          Internal use · Authorized personnel only
        </p>
      </div>
    </div>
  )
}
