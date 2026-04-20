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
import { customerInvoiceScope } from "@/lib/customer-queries"
import { db } from "@/lib/db"
import { formatWIBDate } from "@/lib/time"
import { InvoiceStatus } from "@/prisma/generated/enums"

import { StatusBadge } from "../../../(dgk)/orders/_components/status-badge"

interface InvoicesListPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function CustomerInvoicesListPage({
  searchParams,
}: InvoicesListPageProps) {
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
      ...customerInvoiceScope(organizationId),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      payments: {
        where: { status: "CONFIRMED" },
        select: { amountIDR: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Your invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}, newest
          first.
        </p>
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
            <Link href="/portal/invoices">Clear</Link>
          </Button>
        )}
      </form>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "No invoices match that filter."
              : "No invoices yet. Invoices appear here once DGK issues them against your delivered orders."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
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
                      <Link
                        href={`/portal/invoices/${inv.id}`}
                        className="hover:underline"
                      >
                        {inv.invoiceNumber}
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
