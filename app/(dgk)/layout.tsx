import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { UserRole } from "@/prisma/generated/client"

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
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="font-semibold">DGK ERP</div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {session.user.name}{" "}
            <span className="capitalize">· {roleLabel}</span>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
