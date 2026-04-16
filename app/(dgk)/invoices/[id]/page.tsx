import Link from "next/link"
import { notFound } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatIDR } from "@/lib/currency"
import { db } from "@/lib/db"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { InvoiceStatus } from "@/prisma/generated/enums"

import { StatusBadge } from "../../orders/_components/status-badge"

import { MarkSentButton } from "./mark-sent-button"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      fromOrg: true,
      toOrg: true,
      deliveryOrder: {
        include: { order: { select: { orderNumber: true } } },
      },
    },
  })
  if (!invoice) notFound()

  const typeLabel =
    invoice.type === "VENDOR_TO_DGK" ? "Vendor → DGK" : "DGK → Customer"

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge status={invoice.status} />
            <Badge variant="outline">{typeLabel}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {formatWIBDate(invoice.issueDate)} · Due{" "}
            {formatWIBDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === InvoiceStatus.DRAFT && (
            <MarkSentButton invoiceId={invoice.id} />
          )}
          {invoice.pdfUrl && (
            <Button size="sm" asChild>
              <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/invoices">Back</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">From</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{invoice.fromOrg.name}</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {invoice.fromOrg.address}
            </p>
            {invoice.fromOrg.taxId && (
              <p className="text-muted-foreground">
                NPWP: {invoice.fromOrg.taxId}
              </p>
            )}
            {invoice.fromOrg.bankName && invoice.fromOrg.bankAccount && (
              <p className="text-xs text-muted-foreground">
                Bank: {invoice.fromOrg.bankName} · A/C:{" "}
                {invoice.fromOrg.bankAccount}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{invoice.toOrg.name}</p>
            <p className="whitespace-pre-line text-muted-foreground">
              {invoice.toOrg.address}
            </p>
            {invoice.toOrg.taxId && (
              <p className="text-muted-foreground">
                NPWP: {invoice.toOrg.taxId}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Amounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{formatIDR(invoice.subtotalIDR)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                PPN 1.1% (DPP Nilai Lain)
              </span>
              <span className="font-mono">{formatIDR(invoice.taxIDR)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatIDR(invoice.totalIDR)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">References</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Order:{" "}
            <Link
              href={`/orders/${invoice.deliveryOrder.orderId}`}
              className="font-mono hover:underline"
            >
              {invoice.deliveryOrder.order.orderNumber}
            </Link>
          </p>
          <p>
            Delivery:{" "}
            <Link
              href={`/deliveries/${invoice.deliveryOrderId}`}
              className="font-mono hover:underline"
            >
              {invoice.deliveryOrder.doNumber}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Payment recording lands in Module 9.
            </p>
            <Button
              disabled
              variant="outline"
              size="sm"
              title="Coming in Module 9"
            >
              Record payment
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Invoice created {formatWIBDateTime(invoice.createdAt)} · Internal
        reference — not a Faktur Pajak (DJP) number.
      </p>
    </div>
  )
}
