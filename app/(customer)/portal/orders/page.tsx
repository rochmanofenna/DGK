import Link from "next/link"

import { auth } from "@/auth"
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
import { customerOrderScope } from "@/lib/customer-queries"
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import { OrderStatus, type Region } from "@/prisma/generated/enums"

import { StatusBadge } from "../../../(dgk)/orders/_components/status-badge"

interface OrdersListPageProps {
  searchParams: Promise<{ status?: string }>
}

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}
function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

export default async function CustomerOrdersListPage({
  searchParams,
}: OrdersListPageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const params = await searchParams

  const statusFilter =
    params.status && params.status in OrderStatus
      ? (params.status as OrderStatus)
      : undefined

  const orders = await db.order.findMany({
    where: {
      ...customerOrderScope(organizationId),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/portal/orders/new">New order</Link>
        </Button>
      </div>

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
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
        {params.status && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/portal/orders">Clear</Link>
          </Button>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No orders match that filter."
              : "You haven't submitted any orders yet."}
          </p>
          <Button asChild>
            <Link href="/portal/orders/new">New order</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
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
                    <Link
                      className="hover:underline"
                      href={`/portal/orders/${o.id}`}
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
                    {o.requiredTruckType === "CDEL_2T" ? "CDEL" : "Tronton"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {o.customerPriceIDR ? (
                      formatIDR(o.customerPriceIDR)
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Pending review
                      </span>
                    )}
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
