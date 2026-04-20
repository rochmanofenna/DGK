import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, Package, Truck, type LucideIcon } from "lucide-react"

import { auth } from "@/auth"
import { DGKLogo } from "@/components/brand/dgk-logo"
import { cn } from "@/lib/utils"

import { LoginForm, type LoginVariant } from "./login-form"

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string
    error?: string
    role?: string
  }>
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

function normalizeRole(role: string | undefined): LoginVariant | null {
  if (role === "employee" || role === "client" || role === "carrier") {
    return role
  }
  return null
}

interface RoleConfig {
  title: string
  tagline: string
  accentVar: "--brand-red" | "--brand-blue" | "--brand-green"
  Icon: LucideIcon
}

const ROLE_CONFIG: Record<LoginVariant, RoleConfig> = {
  employee: {
    title: "Employee",
    tagline: "DGK internal operations",
    accentVar: "--brand-red",
    Icon: Building2,
  },
  client: {
    title: "Client",
    tagline: "Track shipments & invoices",
    accentVar: "--brand-blue",
    Icon: Package,
  },
  carrier: {
    title: "Carrier",
    tagline: "Vendor dispatch & delivery",
    accentVar: "--brand-green",
    Icon: Truck,
  },
}

/**
 * Build a `/login` URL that carries the (non-default) `callbackUrl`
 * forward between steps. Passing `role: null` returns to step 1.
 */
function buildLoginHref(
  role: LoginVariant | null,
  callbackUrl: string,
): string {
  const params = new URLSearchParams()
  if (role) params.set("role", role)
  if (callbackUrl !== "/dashboard") params.set("callbackUrl", callbackUrl)
  const qs = params.toString()
  return qs ? `/login?${qs}` : "/login"
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const callbackUrl = sanitizeCallback(params.callbackUrl)

  const session = await auth()
  if (session) redirect(callbackUrl)

  const role = normalizeRole(params.role)

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-6 py-16">
      {/* Thin brand-red rule across the very top — subtle corporate touch */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] bg-[var(--brand-red)]"
      />

      {/* Step 1 spans wide for three cards; step 2 narrows to a single
       * centered form. Same logo lockup + footer either way. */}
      <div className={cn("w-full", role ? "max-w-md" : "max-w-[1120px]")}>
        <div
          className="brand-rise mb-10 flex justify-center"
          style={{ animationDelay: "60ms" }}
        >
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <DGKLogo
              width={role ? 260 : 320}
              priority
              className="block h-auto max-w-full"
            />
          </div>
        </div>

        {role ? (
          <LoginFormCard
            role={role}
            callbackUrl={callbackUrl}
            error={params.error}
          />
        ) : (
          <RolePicker callbackUrl={callbackUrl} />
        )}

        <p
          className="brand-rise mt-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          style={{ animationDelay: "360ms" }}
        >
          Internal use · Authorized personnel only
        </p>
      </div>
    </div>
  )
}

function RolePicker({ callbackUrl }: { callbackUrl: string }) {
  const roles: LoginVariant[] = ["employee", "client", "carrier"]
  return (
    <>
      <h1 className="sr-only">Sign in to DGK ERP</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {roles.map((r, i) => {
          const cfg = ROLE_CONFIG[r]
          const { Icon } = cfg
          return (
            <Link
              key={r}
              href={buildLoginHref(r, callbackUrl)}
              // `--accent` is set inline; every color class below reads it
              // via `var(--accent)` so the card body stays role-agnostic.
              className={cn(
                "brand-rise group relative overflow-hidden rounded-lg border border-border bg-card p-8",
                "shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.08)]",
                "transition-transform duration-150 will-change-transform",
                "hover:-translate-y-0.5 hover:border-[color:var(--accent)]",
                "focus-visible:-translate-y-0.5 focus-visible:border-[color:var(--accent)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]/40",
              )}
              style={
                {
                  animationDelay: `${180 + i * 60}ms`,
                  "--accent": `var(${cfg.accentVar})`,
                } as React.CSSProperties
              }
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px] bg-[color:var(--accent)]"
              />
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-md bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="text-base font-semibold text-foreground">
                  {cfg.title}
                </h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {cfg.tagline}
              </p>
              <span
                aria-hidden
                className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--accent)] opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                Continue
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </>
  )
}

function LoginFormCard({
  role,
  callbackUrl,
  error,
}: {
  role: LoginVariant
  callbackUrl: string
  error?: string
}) {
  const cfg = ROLE_CONFIG[role]
  const { Icon } = cfg
  return (
    <div>
      <div
        className="brand-rise rounded-lg border border-border bg-card p-8 shadow-[0_1px_2px_rgba(17,24,39,0.04),0_8px_24px_-12px_rgba(17,24,39,0.08)]"
        style={{ animationDelay: "180ms" }}
      >
        <div className="mb-6 border-b border-border pb-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <Icon
                className="h-4 w-4"
                style={{ color: `var(${cfg.accentVar})` }}
                aria-hidden
              />
              <h1 className="text-sm font-semibold text-foreground">
                {cfg.title} login
              </h1>
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              v0.1 · MVP
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{cfg.tagline}</p>
        </div>
        <LoginForm
          callbackUrl={callbackUrl}
          initialError={error}
          variant={role}
          autoFocus
        />
      </div>
      <div
        className="brand-rise mt-4 text-center"
        style={{ animationDelay: "240ms" }}
      >
        <Link
          href={buildLoginHref(null, callbackUrl)}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Back to role selection
        </Link>
      </div>
    </div>
  )
}
