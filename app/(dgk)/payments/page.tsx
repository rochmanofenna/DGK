import Link from "next/link"

import { Badge } from "@/components/ui/badge"
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
import { formatWIBDateTime } from "@/lib/time"
import { PaymentMethod } from "@/prisma/generated/enums"

interface PaymentsListPageProps {
  searchParams: Promise<{ method?: string }>
}

export default async function PaymentsListPage({
  searchParams,
}: PaymentsListPageProps) {
  const params = await searchParams
  const methodFilter =
    params.method && params.method in PaymentMethod
      ? (params.method as PaymentMethod)
      : undefined

  const payments = await db.payment.findMany({
    where: {
      ...(methodFilter ? { paymentMethod: methodFilter } : {}),
    },
    include: {
      invoice: {
        select: { id: true, invoiceNumber: true, type: true },
      },
      recordedBy: { select: { name: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          {payments.length} payment{payments.length === 1 ? "" : "s"}, newest first.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Method</label>
          <Select name="method" defaultValue={params.method ?? "ALL"}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All methods</SelectItem>
              <SelectItem value={PaymentMethod.BANK_TRANSFER}>
                Bank transfer
              </SelectItem>
              <SelectItem value={PaymentMethod.QRIS}>QRIS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
        {params.method && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/payments">Clear</Link>
          </Button>
        )}
      </form>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No payments yet — record one from an invoice detail page.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paid</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatWIBDateTime(p.paidAt)}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/invoices/${p.invoice.id}`}
                      className="hover:underline"
                    >
                      {p.invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {p.invoice.type === "VENDOR_TO_DGK" ? "Vendor" : "Customer"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatIDR(p.amountIDR)}
                  </TableCell>
                  <TableCell>
                    {p.paymentMethod === "BANK_TRANSFER" ? "Bank transfer" : "QRIS"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {p.referenceNumber ?? "—"}
                  </TableCell>
                  <TableCell>{p.recordedBy.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
