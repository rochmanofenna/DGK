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
import { vendorInvoiceScope } from "@/lib/vendor-queries"
import { InvoiceStatus } from "@/prisma/generated/enums"

// TODO(phase-2): cross-route-group import — see deliveries/page.tsx.
import { StatusBadge } from "../../../(dgk)/orders/_components/status-badge"

interface CarrierInvoicesListPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function CarrierInvoicesListPage({
  searchParams,
}: CarrierInvoicesListPageProps) {
  const session = await auth()
  if (!session) return null
  const organizationId = session.user.organizationId

  const params = await searchParams
  const statusFilter =
    params.status && params.status in InvoiceStatus
      ? (params.status as InvoiceStatus)
      : undefined

  const invoices = await db.invoice.findMany({
    where: {
      ...vendorInvoiceScope(organizationId),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      deliveryOrder: { select: { doNumber: true, id: true } },
      payments: {
        where: { status: "CONFIRMED" },
        select: { amountIDR: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  const outstandingTotal = invoices.reduce((acc, inv) => {
    const paid = inv.payments.reduce((s, p) => s + p.amountIDR, 0)
    return acc + Math.max(0, inv.totalIDR - paid)
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-6 border-b border-border pb-5">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Carrier finance
          </p>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} from
            DGK, newest first.
          </p>
        </div>
        {outstandingTotal > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Outstanding
            </p>
            <p className="font-mono text-2xl font-semibold">
              {formatIDR(outstandingTotal)}
            </p>
          </div>
        )}
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
              {Object.values(InvoiceStatus).map((s) => (
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
            <Link href="/carrier/invoices">Clear</Link>
          </Button>
        )}
      </form>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No invoices match that filter."
              : "No invoices yet. DGK generates your payment invoice after POD is verified."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>DO #</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const paid = inv.payments.reduce(
                  (s, p) => s + p.amountIDR,
                  0,
                )
                const outstanding = Math.max(0, inv.totalIDR - paid)
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      <Link
                        href={`/carrier/deliveries/${inv.deliveryOrder.id}`}
                        className="hover:underline"
                      >
                        {inv.deliveryOrder.doNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{formatWIBDate(inv.issueDate)}</TableCell>
                    <TableCell>{formatWIBDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatIDR(inv.totalIDR)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {outstanding > 0 ? formatIDR(outstanding) : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm underline"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
