import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { UserRole } from "@/prisma/generated/enums"

import { Sidebar } from "./_components/sidebar"
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
  if (!DGK_ROLES.includes(session.user.role)) redirect("/login")

  const roleLabel = session.user.role.replace(/_/g, " ").toLowerCase()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-xl leading-none tracking-tight">
            DGK
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:inline">
            Dinamika Global Korpora
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-tight">
              {session.user.name}
            </div>
            <div className="text-[10px] uppercase tracking-[0.1em] leading-tight text-muted-foreground">
              {roleLabel}
            </div>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  )
}
