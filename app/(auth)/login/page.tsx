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

      <div className="w-full max-w-[400px]">
        {/* Logo lockup — the image file already contains the icon, the
         * wordmark, and the "Holdings Corporation" subtitle, so no extra
         * text is layered on top. The inner card gives it a soft brand
         * frame that pops off the cool-gray page background; sizing
         * scales down on narrow viewports via max-w-full / h-auto. */}
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

        {/* Sign-in card */}
        <div
          className="brand-rise rounded-lg border border-border bg-card p-8 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.08)]"
          style={{ animationDelay: "180ms" }}
        >
          <div className="mb-6 flex items-baseline justify-between border-b border-border pb-4">
            <h1 className="text-sm font-semibold text-foreground">
              Sign in
            </h1>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              v0.1 · MVP
            </p>
          </div>
          <LoginForm callbackUrl={callbackUrl} initialError={params.error} />
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
