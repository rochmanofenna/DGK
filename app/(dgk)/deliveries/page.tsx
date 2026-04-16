import Link from "next/link"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import type { Region } from "@/prisma/generated/enums"

import { StatusBadge } from "../orders/_components/status-badge"

const REGION_SHORT: Partial<Record<Region, string>> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul",
}

function regionShort(r: Region): string {
  return REGION_SHORT[r] ?? r.charAt(0) + r.slice(1).toLowerCase()
}

export default async function DeliveriesListPage() {
  const deliveries = await db.deliveryOrder.findMany({
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
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          {deliveries.length} delivery order{deliveries.length === 1 ? "" : "s"},
          newest first.
        </p>
      </div>

      {deliveries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No delivery orders yet — assign a vendor to an order to create one.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DO #</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatched</TableHead>
                <TableHead>Delivered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      className="hover:underline"
                      href={`/deliveries/${d.id}`}
                    >
                      {d.doNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <Link
                      className="hover:underline"
                      href={`/orders/${d.orderId}`}
                    >
                      {d.order.orderNumber}
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
                  <TableCell>
                    {d.dispatchedAt ? formatWIBDate(d.dispatchedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {d.deliveredAt ? formatWIBDate(d.deliveredAt) : "—"}
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
