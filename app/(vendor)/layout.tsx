import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DGKLogo } from "@/components/brand/dgk-logo"
import { Button } from "@/components/ui/button"
import { UserRole } from "@/prisma/generated/enums"

import { CarrierNav } from "./_components/carrier-nav"
import { PortalChip } from "./_components/portal-chip"
import { signOutAction } from "./actions"

interface VendorLayoutProps {
  children: React.ReactNode
}

/**
 * Auth + role gate for the carrier/vendor portal. Proxy's `authorized`
 * callback is the first line (sends CUSTOMER_USER to /portal, DGK roles
 * to /dashboard, and unauth'd users to /login); this layout is the
 * second — the backstop if the proxy ever drifts.
 */
export default async function VendorLayout({ children }: VendorLayoutProps) {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/carrier")
  if (session.user.role !== UserRole.VENDOR_USER) redirect("/dashboard")

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-3">
          <DGKLogo width={120} priority />
          <PortalChip />
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight text-foreground">
              {session.user.name}
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] leading-tight text-muted-foreground">
              Carrier
            </div>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <CarrierNav />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  )
}
