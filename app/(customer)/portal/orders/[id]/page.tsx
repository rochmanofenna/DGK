import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import LiveMapClient from "@/components/tracking/live-map-client"
import { TrackingRefresher } from "@/components/tracking/tracking-refresher"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { getTrackingSnapshot } from "@/lib/tracking-queries"
import { DeliveryOrderStatus, type Region } from "@/prisma/generated/enums"

// TODO(phase-2): cross-route-group import. These three components are shared
// between DGK and customer views but still live under `(dgk)/`. Promote them
// to `app/_components/` (or `components/shared/`) once a third consumer
// appears — per the "abstract after two" rule, two callers aren't enough yet.
import { StatusBadge } from "../../../../(dgk)/orders/_components/status-badge"
import { PodDisplay } from "../../../../(dgk)/deliveries/[id]/_components/pod-display"
import { StatusTimeline } from "../../../../(dgk)/deliveries/[id]/_components/status-timeline"

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

const REGION_LABELS: Record<Region, string> = {
  SENTUL_CILEUNGSI_NAROGONG: "Sentul / Cileungsi / Narogong",
  JAKARTA: "Jakarta",
  BEKASI: "Bekasi",
  DEPOK: "Depok",
  BOGOR: "Bogor",
  TANGERANG: "Tangerang",
  BANDUNG: "Bandung",
  SEMARANG: "Semarang",
  YOGYAKARTA: "Yogyakarta",
  PALEMBANG: "Palembang",
  JAMBI: "Jambi",
}

interface PackingItem {
  description: string
  quantity: number
  unit: string
  weightKg?: number | null
}

export default async function CustomerOrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const { id } = await params

  // `findFirst` with a composite filter — `findUnique` only accepts
  // unique keys, but here we need `id` AND the tenancy scope. If the
  // id belongs to another customer, this returns null → notFound().
  const order = await db.order.findFirst({
    where: { id, ...customerOrderScope(organizationId) },
    include: {
      deliveryOrders: {
        include: {
          vendor: {
            include: { organization: { select: { name: true } } },
          },
          assignedBy: { select: { name: true } },
          checklist: {
            include: { verifiedBy: { select: { name: true } } },
            orderBy: { timestamp: "asc" },
          },
          proofOfDelivery: {
            include: {
              uploadedBy: { select: { name: true } },
              verifiedByDgk: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!order) notFound()

  const packing = order.packingList as { items: PackingItem[] } | null
  const items = packing?.items ?? []

  // Customer view shows the pin only (no breadcrumb trail) for every DO
  // on this order. Fetch all snapshots in parallel so the render is
  // still a single DB round-trip from the user's perspective.
  const snapshots = await Promise.all(
    order.deliveryOrders.map((deliv) =>
      getTrackingSnapshot(deliv.id, { withTrail: false }),
    ),
  )
  const snapshotByDoId = new Map(
    order.deliveryOrders.map((deliv, i) => [deliv.id, snapshots[i]!]),
  )
  const anyDispatched = order.deliveryOrders.some(
    (deliv) => deliv.status === DeliveryOrderStatus.DISPATCHED,
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold font-mono">
              {order.orderNumber}
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {formatWIBDateTime(order.createdAt)}
          </p>
        </div>
        <Link
          href="/portal/orders"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to orders
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.customerPriceIDR ? (
              <p className="font-mono text-lg font-semibold">
                {formatIDR(order.customerPriceIDR)}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Pending DGK review — you&apos;ll see the confirmed price here
                once DGK approves the request.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Pickup:{" "}
              <span className="font-medium">
                {formatWIBDate(order.pickupDate)}
              </span>
            </p>
            <p>
              Truck:{" "}
              <span className="font-medium">
                {order.requiredTruckType === "CDEL_2T"
                  ? "CDEL 2-ton"
                  : "Tronton 20-ton"}
              </span>
            </p>
            <p className="text-muted-foreground">
              {REGION_LABELS[order.originRegion]} →{" "}
              {REGION_LABELS[order.destinationRegion]}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pickup address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">
            {order.originAddress}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">
            {order.destinationAddress}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manifest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-line">
            {order.manifestDescription}
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-24">Unit</TableHead>
                <TableHead className="w-28 text-right">Weight (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">
                    {item.weightKg ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">
            {order.notes}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {order.deliveryOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No carrier assigned yet. You&apos;ll see the assigned vendor and
              tracking here once DGK dispatches your shipment.
            </p>
          ) : (
            order.deliveryOrders.map((deliv) => {
              const snapshot = snapshotByDoId.get(deliv.id)
              const pin = snapshot?.pin ?? null
              return (
                <div key={deliv.id} className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{deliv.doNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        Carrier: {deliv.vendor.organization.name}
                      </p>
                    </div>
                    <StatusBadge status={deliv.status} />
                  </div>

                  <StatusTimeline
                    deliveryOrder={{
                      createdAt: deliv.createdAt,
                      dispatchedAt: deliv.dispatchedAt,
                      deliveredAt: deliv.deliveredAt,
                      assignedBy: deliv.assignedBy,
                    }}
                    checklist={deliv.checklist}
                    pod={
                      deliv.proofOfDelivery
                        ? {
                            createdAt: deliv.proofOfDelivery.createdAt,
                            verifiedAt: deliv.proofOfDelivery.verifiedAt,
                            receiverName: deliv.proofOfDelivery.receiverName,
                            uploadedBy: deliv.proofOfDelivery.uploadedBy,
                            verifiedByDgk: deliv.proofOfDelivery.verifiedByDgk,
                          }
                        : null
                    }
                  />

                  {pin && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Live location
                      </p>
                      <LiveMapClient pin={pin} />
                      <p className="text-xs text-muted-foreground">
                        Last fix {formatWIBDateTime(pin.recordedAt)}
                      </p>
                    </div>
                  )}

                  {deliv.proofOfDelivery && (
                    <div className="rounded-md border p-4">
                      <h3 className="mb-3 text-sm font-medium">
                        Proof of delivery
                      </h3>
                      <PodDisplay pod={deliv.proofOfDelivery} />
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <TrackingRefresher enabled={anyDispatched} />
    </div>
  )
}
