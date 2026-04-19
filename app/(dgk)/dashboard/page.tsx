import Link from "next/link"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
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
  DeliveryOrderStatus,
  InvoiceStatus,
  InvoiceType,
  OrderStatus,
  type Region,
} from "@/prisma/generated/enums"

import { StatusBadge } from "../orders/_components/status-badge"

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}
function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
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

export default async function DashboardPage() {
  const session = await auth()
  const now = new Date()

  const activeOrderStatuses: OrderStatus[] = [
    OrderStatus.SUBMITTED,
    OrderStatus.ASSIGNED,
    OrderStatus.IN_TRANSIT,
  ]
  const activeDOStatuses: DeliveryOrderStatus[] = [
    DeliveryOrderStatus.PENDING,
    DeliveryOrderStatus.ACKNOWLEDGED,
    DeliveryOrderStatus.DISPATCHED,
  ]
  const outstandingInvoiceStatuses: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.SENT,
    InvoiceStatus.OVERDUE,
  ]
  const overdueInvoiceStatuses: InvoiceStatus[] = [
    InvoiceStatus.DRAFT,
    InvoiceStatus.SENT,
  ]

  // All queries concurrent — reads only, safe to parallelize.
  const [
    activeOrders,
    activeDeliveries,
    outstandingInvoices,
    overdueInvoicesCount,
    arInvoices,
    apInvoices,
    deliveriesList,
    overdueList,
  ] = await Promise.all([
    db.order.count({ where: { status: { in: activeOrderStatuses } } }),
    db.deliveryOrder.count({ where: { status: { in: activeDOStatuses } } }),
    db.invoice.count({ where: { status: { in: outstandingInvoiceStatuses } } }),
    db.invoice.count({
      where: {
        dueDate: { lt: now },
        status: { in: overdueInvoiceStatuses },
      },
    }),
    db.invoice.findMany({
      where: {
        type: InvoiceType.DGK_TO_CUSTOMER,
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
    db.invoice.findMany({
      where: {
        type: InvoiceType.VENDOR_TO_DGK,
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
    db.deliveryOrder.findMany({
      where: { status: { in: activeDOStatuses } },
      include: {
        order: {
          include: {
            customer: {
              include: { organization: { select: { name: true } } },
            },
          },
        },
        vendor: { include: { organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: overdueInvoiceStatuses },
      },
      include: {
        fromOrg: { select: { name: true } },
        toOrg: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
  ])

  const outstandingOf = (inv: {
    totalIDR: number
    payments: { amountIDR: number }[]
  }) => inv.totalIDR - inv.payments.reduce((s, p) => s + p.amountIDR, 0)

  const arOutstanding = arInvoices.reduce((s, inv) => s + outstandingOf(inv), 0)
  const apOutstanding = apInvoices.reduce((s, inv) => s + outstandingOf(inv), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Operations overview
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            Dashboard
          </h1>
        </div>
        <p className="hidden max-w-sm text-right text-[13px] text-muted-foreground sm:block">
          Welcome, <span className="text-foreground">{session?.user.name}</span>.
          Here&apos;s the state of DGK today.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Widget
          label="Active orders"
          value={activeOrders}
          href="/orders?status=SUBMITTED"
        />
        <Widget
          label="Active deliveries"
          value={activeDeliveries}
          href="/deliveries"
        />
        <Widget
          label="Outstanding invoices"
          value={outstandingInvoices}
          href="/invoices?status=SENT"
        />
        <Widget
          label="AR outstanding"
          value={formatIDR(arOutstanding)}
          href="/invoices?type=DGK_TO_CUSTOMER"
        />
        <Widget
          label="AP outstanding"
          value={formatIDR(apOutstanding)}
          href="/invoices?type=VENDOR_TO_DGK"
        />
        <Widget
          label="Overdue invoices"
          value={overdueInvoicesCount}
          href="/invoices"
          tone={overdueInvoicesCount > 0 ? "alert" : "normal"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Active deliveries</h2>
            <Link
              href="/deliveries"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {deliveriesList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active deliveries — everything in transit is verified and delivered.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DO #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveriesList.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/deliveries/${d.id}`}
                        className="hover:underline"
                      >
                        {d.doNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{d.order.customer.organization.name}</TableCell>
                    <TableCell>{d.vendor.organization.name}</TableCell>
                    <TableCell>
                      {regionShort(d.order.originRegion)} →{" "}
                      {regionShort(d.order.destinationRegion)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Overdue invoices</h2>
            <Link
              href="/invoices"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {overdueList.length === 0 ? (
            <p className="text-sm text-emerald-700">
              All invoices are current.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead className="text-right">Days overdue</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueList.map((inv) => {
                  const daysOverdue = daysBetween(now, inv.dueDate)
                  const counterparty =
                    inv.type === InvoiceType.VENDOR_TO_DGK
                      ? inv.fromOrg.name
                      : inv.toOrg.name
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-sm">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {inv.type === InvoiceType.VENDOR_TO_DGK
                            ? "Vendor"
                            : "Customer"}
                        </Badge>
                      </TableCell>
                      <TableCell>{counterparty}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">
                        {daysOverdue}
                      </TableCell>
                      <TableCell>{formatWIBDate(inv.dueDate)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatIDR(inv.totalIDR)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
