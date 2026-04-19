"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Orders", href: "/orders" },
  { label: "Deliveries", href: "/deliveries" },
  { label: "Invoices", href: "/invoices" },
  { label: "Payments", href: "/payments" },
]

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-sidebar">
      <div className="px-5 pb-3 pt-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Operations
        </p>
      </div>
      <nav className="flex flex-col gap-0.5 px-3 pb-4">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[color-mix(in_oklab,var(--brand-red)_8%,transparent)] font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-6 -translate-y-1/2 rounded-r-full bg-[var(--brand-red)] transition-all",
                  active ? "w-[3px] opacity-100" : "w-0 opacity-0",
                )}
              />
              <span className="relative">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
