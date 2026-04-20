import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import LiveMapClient from "@/components/tracking/live-map-client"
import { TrackingRefresher } from "@/components/tracking/tracking-refresher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatIDR } from "@/lib/currency"
import { db } from "@/lib/db"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { getTrackingSnapshot } from "@/lib/tracking-queries"
import {
  DeliveryOrderStatus,
  InvoiceType,
  UserRole,
} from "@/prisma/generated/enums"

import { StatusBadge } from "../../orders/_components/status-badge"

import { ChecklistForm } from "./_components/checklist-form"
import { GenerateInvoiceButton } from "./_components/generate-invoice-button"
import { PodDisplay } from "./_components/pod-display"
import { PodUploadForm } from "./_components/pod-upload-form"
import { StatusActions } from "./_components/status-actions"
import { StatusTimeline } from "./_components/status-timeline"
import { VerifyPodButton } from "./_components/verify-pod-button"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DeliveryDetailPage({ params }: PageProps) {
  const { id } = await params

  const deliveryOrder = await db.deliveryOrder.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          customer: {
            include: { organization: { select: { name: true } } },
          },
        },
      },
      vendor: {
        include: {
          organization: {
            select: {
              name: true,
              contactPerson: true,
              phone: true,
              email: true,
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
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          type: true,
          status: true,
          totalIDR: true,
          pdfUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })
  if (!deliveryOrder) notFound()

  const session = await auth()
  const canMutate =
    !!session &&
    (session.user.role === UserRole.ADMIN ||
      session.user.role === UserRole.OPS_MANAGER)
  const canGenerateInvoice =
    !!session &&
    (session.user.role === UserRole.ADMIN ||
      session.user.role === UserRole.OPS_MANAGER ||
      session.user.role === UserRole.FINANCE_ADMIN)

  const pod = deliveryOrder.proofOfDelivery
  const isDispatched = deliveryOrder.status === DeliveryOrderStatus.DISPATCHED
  const isDelivered = deliveryOrder.status === DeliveryOrderStatus.DELIVERED
  const showUploadForm = isDispatched && !pod
  const showVerifyButton = isDispatched && pod && !pod.verifiedAt

  const invoiceUnlocked = isDelivered && !!pod?.verifiedAt
  const hasVendorInvoice = deliveryOrder.invoices.some(
    (inv) => inv.type === InvoiceType.VENDOR_TO_DGK,
  )
  const hasCustomerInvoice = deliveryOrder.invoices.some(
    (inv) => inv.type === InvoiceType.DGK_TO_CUSTOMER,
  )

  // DGK sees pin + trail. Query runs even for non-DISPATCHED DOs so a
  // completed delivery still shows its route on the map.
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/orders/${deliveryOrder.orderId}`}>View order</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/deliveries">Back</Link>
          </Button>
        </div>
      </div>

      {/* The state machine decides which buttons render for this role;
       * a FINANCE_ADMIN viewing the page sees no buttons at all, so we
       * can render unconditionally — if `session` is somehow missing
       * the layout already redirected to /login. */}
      {session && (
        <StatusActions
          deliveryOrderId={deliveryOrder.id}
          currentStatus={deliveryOrder.status}
          role={session.user.role}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-mono">
              <Link
                href={`/orders/${deliveryOrder.orderId}`}
                className="hover:underline"
              >
                {deliveryOrder.order.orderNumber}
              </Link>
            </p>
            <p className="font-medium">
              {deliveryOrder.order.customer.organization.name}
            </p>
            <p className="text-muted-foreground">
              Pickup: {formatWIBDate(deliveryOrder.order.pickupDate)}
            </p>
            <p className="text-muted-foreground">
              Agreed price: {formatIDR(deliveryOrder.order.customerPriceIDR ?? 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">
              {deliveryOrder.vendor.organization.name}
            </p>
            <p className="text-muted-foreground">
              Vendor price: {formatIDR(deliveryOrder.vendorPriceIDR)}
            </p>
            <p className="text-muted-foreground">
              Payment terms: net {deliveryOrder.vendor.paymentTermsDays} days
            </p>
            {deliveryOrder.vendor.organization.contactPerson && (
              <p className="text-xs text-muted-foreground">
                {deliveryOrder.vendor.organization.contactPerson} ·{" "}
                {deliveryOrder.vendor.organization.phone}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Timeline</CardTitle>
          <ChecklistForm
            deliveryOrderId={deliveryOrder.id}
            canMutate={canMutate}
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

      {tracking.pin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <LiveMapClient pin={tracking.pin} trail={tracking.trail} />
            <p className="text-xs text-muted-foreground">
              Last fix {formatWIBDateTime(tracking.pin.recordedAt)}
              {tracking.pin.accuracyMeters
                ? ` · ±${Math.round(tracking.pin.accuracyMeters)} m`
                : ""}
              {" · "}
              {tracking.trail.length} point
              {tracking.trail.length === 1 ? "" : "s"} plotted
            </p>
            <TrackingRefresher enabled={isDispatched} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Proof of Delivery</CardTitle>
          {showVerifyButton && (
            <VerifyPodButton
              deliveryOrderId={deliveryOrder.id}
              canVerify={canMutate}
            />
          )}
        </CardHeader>
        <CardContent>
          {!pod ? (
            showUploadForm ? (
              <PodUploadForm
                deliveryOrderId={deliveryOrder.id}
                canMutate={canMutate}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                POD upload opens once this delivery is Dispatched.
              </p>
            )
          ) : (
            <PodDisplay pod={pod} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoicing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoiceUnlocked ? (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <GenerateInvoiceButton
                  deliveryOrderId={deliveryOrder.id}
                  type={InvoiceType.VENDOR_TO_DGK}
                  label="Generate vendor invoice"
                  canMutate={canGenerateInvoice}
                  alreadyExists={hasVendorInvoice}
                />
                <GenerateInvoiceButton
                  deliveryOrderId={deliveryOrder.id}
                  type={InvoiceType.DGK_TO_CUSTOMER}
                  label="Generate customer invoice"
                  canMutate={canGenerateInvoice}
                  alreadyExists={hasCustomerInvoice}
                />
              </div>
              {deliveryOrder.invoices.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  {deliveryOrder.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="font-mono hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <Badge variant="outline">
                          {inv.type === InvoiceType.VENDOR_TO_DGK
                            ? "Vendor"
                            : "Customer"}
                        </Badge>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono">
                          {formatIDR(inv.totalIDR)}
                        </span>
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
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Invoice generation unlocks after POD is verified.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
