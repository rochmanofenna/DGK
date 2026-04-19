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

/**
 * Primary navigation for the DGK staff area. Sits directly under the
 * header as a second band — header row carries identity (logo + user),
 * this row carries page links. Matches the marketing site's nav tone
 * (small uppercase labels, red underline tick on active) so the two
 * surfaces feel like one family without aping each other.
 */
export function TopNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="border-b border-border bg-card"
    >
      <ul className="flex items-stretch overflow-x-auto px-6">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex items-center whitespace-nowrap px-4 py-3 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-4 bottom-0 h-[2px] bg-[var(--brand-red)] origin-left transition-transform duration-200",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
