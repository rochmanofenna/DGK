import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import LiveMapClient from "@/components/tracking/live-map-client"
import { TrackingRefresher } from "@/components/tracking/tracking-refresher"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatIDR } from "@/lib/currency"
import { db } from "@/lib/db"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { getTrackingSnapshot } from "@/lib/tracking-queries"
import { vendorDeliveryScope } from "@/lib/vendor-queries"
import {
  DeliveryOrderStatus,
  InvoiceType,
  type Region,
} from "@/prisma/generated/enums"

// TODO(phase-2): cross-route-group imports. Third consumer (carrier) has
// arrived — time to promote these to `components/shared/` per the
// "abstract after two" rule. Queued in the nav/shared-components refactor
// follow-up; leaving as relative imports for this sub-commit to keep the
// diff minimal.
import { StatusBadge } from "../../../../(dgk)/orders/_components/status-badge"
import { ChecklistForm } from "../../../../(dgk)/deliveries/[id]/_components/checklist-form"
import { PodDisplay } from "../../../../(dgk)/deliveries/[id]/_components/pod-display"
import { PodUploadForm } from "../../../../(dgk)/deliveries/[id]/_components/pod-upload-form"
import { StatusActions } from "../../../../(dgk)/deliveries/[id]/_components/status-actions"
import { StatusTimeline } from "../../../../(dgk)/deliveries/[id]/_components/status-timeline"

import { TrackingControls } from "./_components/tracking-controls"

interface CarrierDeliveryDetailPageProps {
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

export default async function CarrierDeliveryDetailPage({
  params,
}: CarrierDeliveryDetailPageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const { id } = await params

  // `findFirst` with tenancy scope — a DO id that belongs to another
  // vendor returns null, which we map to notFound() rather than a 403.
  // Returning 404 instead of "forbidden" denies the caller the ability
  // to confirm the id exists at all (enumeration defence).
  const deliveryOrder = await db.deliveryOrder.findFirst({
    where: { id, ...vendorDeliveryScope(organizationId) },
    include: {
      order: {
        include: {
          customer: {
            include: {
              organization: {
                select: { name: true, contactPerson: true, phone: true },
              },
            },
          },
        },
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
      // Vendor can only see their own VENDOR_TO_DGK invoices. Customer
      // invoices live on the same DO but are DGK's business, not theirs.
      invoices: {
        where: { type: InvoiceType.VENDOR_TO_DGK },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          totalIDR: true,
          pdfUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!deliveryOrder) notFound()

  const pod = deliveryOrder.proofOfDelivery
  const isDispatched = deliveryOrder.status === DeliveryOrderStatus.DISPATCHED
  const showUploadForm = isDispatched && !pod

  // Carrier sees their own trail (pin + breadcrumbs) when tracking data
  // exists for this DO. We query even if not dispatched yet so the map
  // can show a "delivered route" once the trip is done.
  const tracking = await getTrackingSnapshot(deliveryOrder.id, {
    withTrail: true,
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {deliveryOrder.doNumber}
            </h1>
            <StatusBadge status={deliveryOrder.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned {formatWIBDateTime(deliveryOrder.createdAt)} by{" "}
            {deliveryOrder.assignedBy.name}
          </p>
        </div>
        <Link
          href="/carrier/deliveries"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to deliveries
        </Link>
      </div>

      {/* Carrier-facing actions: the state machine filters for VENDOR_USER,
       * so the only buttons that render here are the forward-path transitions
       * the vendor is allowed (ACKNOWLEDGED → DISPATCHED). Cancellations
       * stay DGK-only and never render here. */}
      <StatusActions
        deliveryOrderId={deliveryOrder.id}
        currentStatus={deliveryOrder.status}
        role={session.user.role}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono text-xs text-muted-foreground">
              Order {deliveryOrder.order.orderNumber}
            </p>
            <p className="font-medium">
              {deliveryOrder.order.customer.organization.name}
            </p>
            <p className="text-muted-foreground">
              Pickup: {formatWIBDate(deliveryOrder.order.pickupDate)}
            </p>
            <p className="text-muted-foreground">
              {REGION_LABELS[deliveryOrder.order.originRegion]} →{" "}
              {REGION_LABELS[deliveryOrder.order.destinationRegion]}
            </p>
            <p className="text-muted-foreground">
              Truck:{" "}
              {deliveryOrder.order.requiredTruckType === "CDEL_2T"
                ? "CDEL 2-ton"
                : "Tronton 20-ton"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono text-lg font-semibold">
              {formatIDR(deliveryOrder.vendorPriceIDR)}
            </p>
            <p className="text-xs text-muted-foreground">
              Invoice is generated by DGK once POD is verified.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pickup address</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm">
            {deliveryOrder.order.originAddress}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery address</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-line text-sm">
            {deliveryOrder.order.destinationAddress}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manifest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">
            {deliveryOrder.order.manifestDescription}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Timeline</CardTitle>
          <ChecklistForm
            deliveryOrderId={deliveryOrder.id}
            canMutate={true}
          />
        </CardHeader>
        <CardContent>
          <StatusTimeline
            deliveryOrder={{
              createdAt: deliveryOrder.createdAt,
              dispatchedAt: deliveryOrder.dispatchedAt,
              deliveredAt: deliveryOrder.deliveredAt,
              assignedBy: deliveryOrder.assignedBy,
            }}
            checklist={deliveryOrder.checklist}
            pod={pod}
          />
        </CardContent>
      </Card>

      {(isDispatched || tracking.pin) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDispatched && (
              <TrackingControls deliveryOrderId={deliveryOrder.id} />
            )}
            {tracking.pin ? (
              <>
                <LiveMapClient
                  pin={tracking.pin}
                  trail={tracking.trail}
                />
                <p className="text-xs text-muted-foreground">
                  Last fix {formatWIBDateTime(tracking.pin.recordedAt)}
                  {tracking.pin.accuracyMeters
                    ? ` · ±${Math.round(tracking.pin.accuracyMeters)} m`
                    : ""}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No location shared yet. Start tracking to pin this delivery on
                the map for DGK and the customer.
              </p>
            )}
            <TrackingRefresher enabled={isDispatched} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proof of Delivery</CardTitle>
        </CardHeader>
        <CardContent>
          {!pod ? (
            showUploadForm ? (
              <PodUploadForm
                deliveryOrderId={deliveryOrder.id}
                canMutate={true}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                POD upload opens once this delivery is Dispatched.
              </p>
            )
          ) : (
            <div className="space-y-3">
              <PodDisplay pod={pod} />
              {!pod.verifiedAt && (
                <p className="text-xs text-muted-foreground">
                  Waiting on DGK to verify your submission.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {deliveryOrder.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deliveryOrder.invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono">{inv.invoiceNumber}</span>
                  <Badge variant="outline">Vendor → DGK</Badge>
                  <StatusBadge status={inv.status} />
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">{formatIDR(inv.totalIDR)}</span>
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm underline"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
