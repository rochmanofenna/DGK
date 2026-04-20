import Link from "next/link"
import { notFound } from "next/navigation"

import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatIDR } from "@/lib/currency"
import { customerInvoiceScope } from "@/lib/customer-queries"
import { db } from "@/lib/db"
import { formatWIBDate, formatWIBDateTime } from "@/lib/time"
import { PaymentStatus } from "@/prisma/generated/enums"

import { StatusBadge } from "../../../../(dgk)/orders/_components/status-badge"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerInvoiceDetailPage({ params }: PageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const { id } = await params

  // Scoped lookup — `findFirst` because we're composing `id` with the
  // tenancy/type filter. If the id belongs to a different customer or
  // is a VENDOR_TO_DGK invoice, this returns null → notFound().
  const invoice = await db.invoice.findFirst({
    where: { id, ...customerInvoiceScope(organizationId) },
    include: {
      fromOrg: true,
      toOrg: true,
      deliveryOrder: {
        include: { order: { select: { id: true, orderNumber: true } } },
      },
      payments: {
        where: { status: PaymentStatus.CONFIRMED },
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amountIDR: true,
          paymentMethod: true,
          referenceNumber: true,
          paidAt: true,
        },
      },
    },
  })
  if (!invoice) notFound()

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amountIDR, 0)
  const remaining = Math.max(0, invoice.totalIDR - totalPaid)
  const paidPct =
    invoice.totalIDR > 0
      ? Math.min(100, Math.round((totalPaid / invoice.totalIDR) * 100))
      : 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold">
              {invoice.invoiceNumber}
            </h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {formatWIBDate(invoice.issueDate)} · Due{" "}
            {formatWIBDate(invoice.dueDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.pdfUrl && (
            <Button size="sm" asChild>
              <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/portal/invoices">Back</Link>
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
            <CardTitle className="text-base">Billed to</CardTitle>
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
          <CardTitle className="text-base">Reference</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p>
            Order:{" "}
            <Link
              href={`/portal/orders/${invoice.deliveryOrder.order.id}`}
              className="font-mono hover:underline"
            >
              {invoice.deliveryOrder.order.orderNumber}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Paid so far</span>
              <span className="font-mono">
                {formatIDR(totalPaid)} / {formatIDR(invoice.totalIDR)}
                {" · "}
                {paidPct}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[color:var(--brand-blue)] transition-all"
                style={{ width: `${paidPct}%` }}
                aria-hidden
              />
            </div>
          </div>

          {remaining > 0 && (
            <p className="text-sm">
              Outstanding:{" "}
              <span className="font-mono font-semibold">
                {formatIDR(remaining)}
              </span>
            </p>
          )}

          {/* TODO(phase-2): customers are read-only for payments — DGK records
              them on their behalf after reconciling the bank transfer / QRIS
              receipt. A real customer portal would let them "declare" a
              payment (upload receipt, enter reference) that flows into a
              finance review queue. Out of MVP scope; revisit with finance. */}
          {invoice.payments.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Payments received
              </h3>
              <div className="space-y-2">
                {invoice.payments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono">
                        {formatIDR(p.amountIDR)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatWIBDateTime(p.paidAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {p.paymentMethod === "BANK_TRANSFER"
                          ? "Bank transfer"
                          : "QRIS"}
                      </span>
                      {p.referenceNumber && (
                        <span className="font-mono">
                          Ref: {p.referenceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No payments recorded yet. DGK records payments after they
              reconcile your bank transfer or QRIS receipt.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Invoice created {formatWIBDateTime(invoice.createdAt)} · Internal
        reference — not a Faktur Pajak (DJP) number.
      </p>
    </div>
  )
}
