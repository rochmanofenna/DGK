import { auth } from "@/auth"

/**
 * Carrier dashboard — placeholder shell for sub-commit 1. The real widgets
 * (pending acknowledgments count, active deliveries, completed this month)
 * land in the sub-commit that wires up the DO list and detail pages.
 * Keeping this intentionally thin so the three-portal login plumbing can
 * be smoke-tested end-to-end without the vendor-facing DO surface yet.
 */
export default async function CarrierDashboardPage() {
  // Layout already rejected non-VENDOR_USER sessions; the null-guard is
  // defence in depth so types stay honest.
  const session = await auth()
  if (!session) return null

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Carrier overview
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            Dashboard
          </h1>
        </div>
        <p className="hidden max-w-sm text-right text-[13px] text-muted-foreground sm:block">
          Welcome, <span className="text-foreground">{session.user.name}</span>.
          Your delivery queue and tracking tools will appear here.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No deliveries assigned yet. DGK will send DOs to your queue once
          orders are confirmed.
        </p>
      </div>
    </div>
  )
}
