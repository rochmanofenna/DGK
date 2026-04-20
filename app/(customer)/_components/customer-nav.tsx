"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

interface NavItem {
  label: string
  href: string
}

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/portal" },
  { label: "Orders", href: "/portal/orders" },
  { label: "Invoices", href: "/portal/invoices" },
]

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true
  // `/portal` must not match `/portal/orders` — guard with an exact
  // check on the root and a prefix check on children.
  if (href === "/portal") return false
  return pathname.startsWith(`${href}/`)
}

/**
 * Customer portal primary nav. Mirrors the DGK TopNav shape so the two
 * surfaces feel like one family — only the active-state underline
 * changes from brand red to brand blue. That single colour difference
 * is the visual cue DGK staff rely on to know which portal they're in
 * when testing with a customer account.
 */
export function CustomerNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Primary" className="border-b border-border bg-card">
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
                    "absolute inset-x-4 bottom-0 h-[2px] bg-[var(--brand-blue)] origin-left transition-transform duration-200",
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
