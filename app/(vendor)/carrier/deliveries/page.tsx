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
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import { vendorDeliveryScope } from "@/lib/vendor-queries"
import { DeliveryOrderStatus, type Region } from "@/prisma/generated/enums"

// TODO(phase-2): cross-route-group import. Same situation as (customer) —
// StatusBadge is shared across three portals now; next iteration should
// promote it to `components/shared/` per the "abstract after two" rule.
// The third caller is the trigger — this is it.
import { StatusBadge } from "../../../(dgk)/orders/_components/status-badge"

interface CarrierDeliveriesPageProps {
  searchParams: Promise<{ status?: string }>
}

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}
function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

export default async function CarrierDeliveriesPage({
  searchParams,
}: CarrierDeliveriesPageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const params = await searchParams
  const statusFilter =
    params.status && params.status in DeliveryOrderStatus
      ? (params.status as DeliveryOrderStatus)
      : undefined

  const deliveries = await db.deliveryOrder.findMany({
    where: {
      ...vendorDeliveryScope(organizationId),
      ...(statusFilter ? { status: statusFilter } : {}),
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
    take: 100,
  })

  const pendingCount = deliveries.filter(
    (d) => d.status === DeliveryOrderStatus.PENDING,
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Carrier queue
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            Deliveries
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {deliveries.length} delivery order
            {deliveries.length === 1 ? "" : "s"}
            {pendingCount > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {pendingCount} pending acknowledgment
                </span>
              </>
            )}
            .
          </p>
        </div>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select name="status" defaultValue={params.status ?? "ALL"}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {Object.values(DeliveryOrderStatus).map((s) => (
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
            <Link href="/carrier/deliveries">Clear</Link>
          </Button>
        )}
      </form>

      {deliveries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No deliveries match that filter."
              : "No delivery orders assigned yet. DGK will send DOs here once orders are confirmed."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DO #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Pickup</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Vendor price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      className="hover:underline"
                      href={`/carrier/deliveries/${d.id}`}
                    >
                      {d.doNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{d.order.customer.organization.name}</TableCell>
                  <TableCell>
                    {regionShort(d.order.originRegion)} →{" "}
                    {regionShort(d.order.destinationRegion)}
                  </TableCell>
                  <TableCell>{formatWIBDate(d.order.pickupDate)}</TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatIDR(d.vendorPriceIDR)}
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
