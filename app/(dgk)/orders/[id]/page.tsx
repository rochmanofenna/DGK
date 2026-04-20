import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { db } from "@/lib/db"
import { findVendorCandidatesForOrder } from "@/lib/rate-cards"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { OrderStatus, UserRole, type Region } from "@/prisma/generated/enums"

import { StatusBadge } from "../_components/status-badge"

import { ApproveDraftCard } from "./approve-draft-card"
import { AssignVendorDialog } from "./assign-vendor-dialog"
import { CancelOrderButton } from "./cancel-order-button"

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

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params

  const order = await db.order.findUnique({
    where: { id },
    include: {
      customer: { include: { organization: { select: { name: true } } } },
      createdBy: { select: { name: true } },
      deliveryOrders: { select: { id: true, doNumber: true, status: true } },
    },
  })
  if (!order) notFound()

  const packing = order.packingList as { items: PackingItem[] } | null
  const items = packing?.items ?? []

  const isDraft = order.status === OrderStatus.DRAFT
  const cancellable = order.status === OrderStatus.SUBMITTED
  const assignable =
    order.status === OrderStatus.SUBMITTED && order.deliveryOrders.length === 0

  const session = await auth()
  const canAssign =
    !!session &&
    (session.user.role === UserRole.ADMIN ||
      session.user.role === UserRole.OPS_MANAGER)
  const canApproveDraft = canAssign

  // Only query rate-card candidates when we're actually going to offer
  // assignment — no point hitting the DB for ASSIGNED / DELIVERED / etc.
  const vendorCandidates = assignable
    ? await findVendorCandidatesForOrder({
        originRegion: order.originRegion,
        destinationRegion: order.destinationRegion,
        requiredTruckType: order.requiredTruckType,
      })
    : []

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
            {isDraft ? "Submitted" : "Created"}{" "}
            {formatWIBDateTime(order.createdAt)} by {order.createdBy.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/orders">Back</Link>
          </Button>
          {cancellable && <CancelOrderButton orderId={order.id} />}
        </div>
      </div>

      {isDraft && (
        <ApproveDraftCard
          orderId={order.id}
          disabled={!canApproveDraft}
          disabledReason="Ops Manager role required"
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.customer.organization.name}</p>
            <p className="text-muted-foreground">
              Agreed price:{" "}
              {order.customerPriceIDR
                ? formatIDR(order.customerPriceIDR)
                : "Pending approval"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Pickup: <span className="font-medium">{formatWIBDate(order.pickupDate)}</span>
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
            <CardTitle className="text-base">Origin</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-line">
            {order.originAddress}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Destination</CardTitle>
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

      {!isDraft && (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliveries</CardTitle>
        </CardHeader>
        <CardContent>
          {order.deliveryOrders.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No vendor assigned yet.
              </p>
              {assignable && (
                <AssignVendorDialog
                  orderId={order.id}
                  routeLabel={`${REGION_LABELS[order.originRegion]} → ${REGION_LABELS[order.destinationRegion]}`}
                  truckLabel={
                    order.requiredTruckType === "CDEL_2T"
                      ? "CDEL 2-ton"
                      : "Tronton 20-ton"
                  }
                  candidates={vendorCandidates}
                  disabled={!canAssign}
                  disabledReason="Ops Manager role required"
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {order.deliveryOrders.map((dOrder) => (
                <Link
                  key={dOrder.id}
                  href={`/deliveries/${dOrder.id}`}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="font-mono">{dOrder.doNumber}</span>
                  <Badge variant="outline">{dOrder.status}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}
