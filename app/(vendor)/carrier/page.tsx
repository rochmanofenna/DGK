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
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import {
  vendorDeliveryScope,
  vendorInvoiceScope,
} from "@/lib/vendor-queries"
import {
  DeliveryOrderStatus,
  InvoiceStatus,
  type Region,
} from "@/prisma/generated/enums"

// TODO(phase-2): cross-route-group import — promote to components/shared/.
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
  tone?: "normal" | "alert" | "positive"
}
function Widget({ label, value, href, tone = "normal" }: WidgetProps) {
  const toneClass =
    tone === "alert"
      ? "text-destructive"
      : tone === "positive"
        ? "text-[color:var(--brand-green)]"
        : "text-foreground"
  return (
    <Link
      href={href}
      className="group/widget relative block overflow-hidden rounded-md border border-border bg-card px-5 py-5 transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-[0_2px_12px_-4px_rgba(17,24,39,0.08)]"
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-3 text-[1.875rem] font-semibold leading-none tracking-tight tabular-nums ${toneClass}`}
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

const actionableStatuses: DeliveryOrderStatus[] = [
  DeliveryOrderStatus.PENDING,
  DeliveryOrderStatus.ACKNOWLEDGED,
  DeliveryOrderStatus.DISPATCHED,
]
const outstandingInvoiceStatuses: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
]

// Approximate "start of current month" as UTC 1st at 00:00. DGK operates
// in WIB (UTC+7), so there's up to a 7-hour skew at month turnover — the
// widget is informational only, not a billing boundary, so the skew is
// acceptable. Revisit if a month-accurate widget is ever needed.
function startOfMonthUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export default async function CarrierDashboardPage() {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const deliveryScope = vendorDeliveryScope(organizationId)
  const invoiceScope = vendorInvoiceScope(organizationId)
  const monthStart = startOfMonthUTC()

  const [
    pendingCount,
    activeCount,
    deliveredThisMonth,
    outstandingInvoices,
    actionable,
  ] = await Promise.all([
    db.deliveryOrder.count({
      where: { ...deliveryScope, status: DeliveryOrderStatus.PENDING },
    }),
    db.deliveryOrder.count({
      where: {
        ...deliveryScope,
        status: {
          in: [
            DeliveryOrderStatus.ACKNOWLEDGED,
            DeliveryOrderStatus.DISPATCHED,
          ],
        },
      },
    }),
    db.deliveryOrder.count({
      where: {
        ...deliveryScope,
        status: DeliveryOrderStatus.DELIVERED,
        deliveredAt: { gte: monthStart },
      },
    }),
    db.invoice.findMany({
      where: {
        ...invoiceScope,
        status: { in: outstandingInvoiceStatuses },
      },
      select: {
        totalIDR: true,
        payments: {
          where: { status: "CONFIRMED" },
          select: { amountIDR: true },
        },
      },
    }),
    db.deliveryOrder.findMany({
      where: {
        ...deliveryScope,
        status: { in: actionableStatuses },
      },
      include: {
        order: {
          include: {
            customer: {
              include: { organization: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const totalOutstanding = outstandingInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountIDR, 0)
    return sum + Math.max(0, inv.totalIDR - paid)
  }, 0)

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
          Here&apos;s your delivery queue with DGK.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Widget
          label="Pending acks"
          value={pendingCount}
          href="/carrier/deliveries?status=PENDING"
          tone={pendingCount > 0 ? "alert" : "normal"}
        />
        <Widget
          label="Active deliveries"
          value={activeCount}
          href="/carrier/deliveries"
        />
        <Widget
          label="Completed this month"
          value={deliveredThisMonth}
          href="/carrier/deliveries?status=DELIVERED"
          tone="positive"
        />
        <Widget
          label="Outstanding payments"
          value={formatIDR(totalOutstanding)}
          href="/carrier/invoices"
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Needs your attention</h2>
            <Link
              href="/carrier/deliveries"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {actionable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active deliveries. New DOs from DGK appear here as they&apos;re
              assigned.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DO #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionable.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/carrier/deliveries/${d.id}`}
                        className="hover:underline"
                      >
                        {d.doNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {d.order.customer.organization.name}
                    </TableCell>
                    <TableCell>
                      {regionShort(d.order.originRegion)} →{" "}
                      {regionShort(d.order.destinationRegion)}
                    </TableCell>
                    <TableCell>{formatWIBDate(d.order.pickupDate)}</TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatIDR(d.vendorPriceIDR)}
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
