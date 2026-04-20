import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { OrderStatus, type Region } from "@/prisma/generated/enums"

import { StatusBadge } from "./_components/status-badge"

interface OrdersListPageProps {
  searchParams: Promise<{ status?: string; customer?: string }>
}

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}

function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

export default async function OrdersListPage({
  searchParams,
}: OrdersListPageProps) {
  const params = await searchParams

  const statusFilter =
    params.status && params.status in OrderStatus
      ? (params.status as OrderStatus)
      : undefined
  const customerFilter = params.customer || undefined

  const [orders, customers, draftCount] = await Promise.all([
    db.order.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(customerFilter ? { customerId: customerFilter } : {}),
      },
      include: {
        customer: { include: { organization: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.customer.findMany({
      select: { id: true, organization: { select: { name: true } } },
      orderBy: { organization: { name: "asc" } },
    }),
    db.order.count({ where: { status: OrderStatus.DRAFT } }),
  ])

  // Only show the DRAFT banner when the current view isn't already the
  // DRAFT-only filter — otherwise it's noise on a page that already answers
  // the question it's asking.
  const showDraftBanner = draftCount > 0 && statusFilter !== OrderStatus.DRAFT

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"} shown, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/orders/new">New order</Link>
        </Button>
      </div>

      {showDraftBanner && (
        <Link
          href="/orders?status=DRAFT"
          className="flex items-center justify-between rounded-md border-2 border-amber-300/70 bg-amber-50/60 px-4 py-3 text-sm transition-colors hover:bg-amber-50 dark:border-amber-700/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
        >
          <span className="font-medium text-amber-900 dark:text-amber-100">
            {draftCount} draft order{draftCount === 1 ? "" : "s"} awaiting review
          </span>
          <span className="text-xs text-amber-900/80 dark:text-amber-100/80">
            Review &amp; publish →
          </span>
        </Link>
      )}

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select name="status" defaultValue={params.status ?? "ALL"}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {Object.values(OrderStatus).map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Customer
          </label>
          <Select name="customer" defaultValue={params.customer ?? "ALL"}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
        {(params.status || params.customer) && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/orders">Clear</Link>
          </Button>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No orders yet — create your first one to get started.
          </p>
          <Button asChild>
            <Link href="/orders/new">New order</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Truck</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">
                    <Link className="hover:underline" href={`/orders/${o.id}`}>
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{o.customer.organization.name}</TableCell>
                  <TableCell>{formatWIBDate(o.pickupDate)}</TableCell>
                  <TableCell>
                    {regionShort(o.originRegion)} → {regionShort(o.destinationRegion)}
                  </TableCell>
                  <TableCell>
                    {o.requiredTruckType === "CDEL_2T" ? "CDEL" : "Tronton"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {o.customerPriceIDR ? formatIDR(o.customerPriceIDR) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
