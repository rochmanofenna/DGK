import Link from "next/link"

import { auth } from "@/auth"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatIDR } from "@/lib/currency"
import {
  customerInvoiceScope,
  customerOrderScope,
} from "@/lib/customer-queries"
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import {
  InvoiceStatus,
  OrderStatus,
  type Region,
} from "@/prisma/generated/enums"

import { StatusBadge } from "../../(dgk)/orders/_components/status-badge"

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}
function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

interface WidgetProps {
  label: string
  value: string | number
  href: string
  tone?: "normal" | "alert"
}
function Widget({ label, value, href, tone = "normal" }: WidgetProps) {
  return (
    <Link
      href={href}
      className="group/widget relative block overflow-hidden rounded-md border border-border bg-card px-5 py-5 transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-[0_2px_12px_-4px_rgba(17,24,39,0.08)]"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-3 text-[1.875rem] font-semibold leading-none tracking-tight tabular-nums ${
          tone === "alert" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <span
        aria-hidden
        className="absolute right-4 top-5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/widget:opacity-100"
      >
        →
      </span>
    </Link>
  )
}

const activeOrderStatuses: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.SUBMITTED,
  OrderStatus.ASSIGNED,
  OrderStatus.IN_TRANSIT,
]
const outstandingInvoiceStatuses: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
]

export default async function CustomerDashboardPage() {
  // Layout already rejected non-CUSTOMER_USER sessions; asserting here so
  // queries can use `session.user.organizationId` without a null check.
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const orderScope = customerOrderScope(organizationId)
  const invoiceScope = customerInvoiceScope(organizationId)

  const [
    activeOrderCount,
    outstandingInvoiceCount,
    outstandingInvoices,
    activeOrders,
  ] = await Promise.all([
    db.order.count({
      where: { ...orderScope, status: { in: activeOrderStatuses } },
    }),
    db.invoice.count({
      where: { ...invoiceScope, status: { in: outstandingInvoiceStatuses } },
    }),
    db.invoice.findMany({
      where: {
        ...invoiceScope,
        status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED] },
      },
      select: {
        totalIDR: true,
        payments: {
          where: { status: "CONFIRMED" },
          select: { amountIDR: true },
        },
      },
    }),
    db.order.findMany({
      where: { ...orderScope, status: { in: activeOrderStatuses } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const totalOwed = outstandingInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountIDR, 0)
    return sum + Math.max(0, inv.totalIDR - paid)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Client overview
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            Dashboard
          </h1>
        </div>
        <p className="hidden max-w-sm text-right text-[13px] text-muted-foreground sm:block">
          Welcome, <span className="text-foreground">{session.user.name}</span>.
          Here&apos;s the state of your shipments with DGK.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Widget
          label="Active orders"
          value={activeOrderCount}
          href="/portal/orders"
        />
        <Widget
          label="Outstanding invoices"
          value={outstandingInvoiceCount}
          href="/portal/invoices"
        />
        <Widget
          label="Total owed"
          value={formatIDR(totalOwed)}
          href="/portal/invoices"
          tone={totalOwed > 0 ? "alert" : "normal"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active orders</h2>
            <Link
              href="/portal/orders"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                No active orders. Submit a shipping request to get started.
              </p>
              <Link
                href="/portal/orders/new"
                className="text-sm font-medium text-[color:var(--brand-blue)] hover:underline"
              >
                New shipping request →
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeOrders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/portal/orders/${o.id}`}
                        className="hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{formatWIBDate(o.pickupDate)}</TableCell>
                    <TableCell>
                      {regionShort(o.originRegion)} →{" "}
                      {regionShort(o.destinationRegion)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
