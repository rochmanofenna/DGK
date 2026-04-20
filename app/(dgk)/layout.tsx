import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { DGKLogo } from "@/components/brand/dgk-logo"
import { Button } from "@/components/ui/button"
import { UserRole } from "@/prisma/generated/enums"

import { TopNav } from "./_components/top-nav"
import { signOutAction } from "./actions"

const DGK_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.OPS_MANAGER,
  UserRole.FINANCE_ADMIN,
]

interface DgkLayoutProps {
  children: React.ReactNode
}

/**
 * Auth + role gate for the DGK staff area. Proxy is the first line of
 * defence (redirects unauth'd users to /login); this layout is the
 * second — catches any case where the request reached Server Component
 * render and also exposes `session.user` to children via prop/context.
 */
export default async function DgkLayout({ children }: DgkLayoutProps) {
  const session = await auth()
  if (!session) redirect("/login?callbackUrl=/dashboard")
  // Send mis-role'd sessions directly to the right portal instead of
  // bouncing through /login. The proxy should catch these first; this
  // is the backstop, and it shouldn't create ping-pong.
  if (session.user.role === UserRole.CUSTOMER_USER) redirect("/portal")
  if (session.user.role === UserRole.VENDOR_USER) redirect("/carrier")
  if (!DGK_ROLES.includes(session.user.role)) redirect("/login")

  const roleLabel = session.user.role.replace(/_/g, " ").toLowerCase()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
        <DGKLogo width={120} priority />
        <div className="flex items-center gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight text-foreground">
              {session.user.name}
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] leading-tight text-muted-foreground">
              {roleLabel}
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
      <TopNav />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  )
}
