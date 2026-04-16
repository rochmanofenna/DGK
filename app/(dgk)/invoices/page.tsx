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
import { formatWIBDate } from "@/lib/time"
import { InvoiceStatus, InvoiceType } from "@/prisma/generated/enums"

import { StatusBadge } from "../orders/_components/status-badge"

interface InvoicesListPageProps {
  searchParams: Promise<{ type?: string; status?: string }>
}

export default async function InvoicesListPage({
  searchParams,
}: InvoicesListPageProps) {
  const params = await searchParams

  const typeFilter =
    params.type && params.type in InvoiceType
      ? (params.type as InvoiceType)
      : undefined
  const statusFilter =
    params.status && params.status in InvoiceStatus
      ? (params.status as InvoiceStatus)
      : undefined

  const invoices = await db.invoice.findMany({
    where: {
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      fromOrg: { select: { name: true } },
      toOrg: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {invoices.length} invoice{invoices.length === 1 ? "" : "s"}, newest first.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select name="type" defaultValue={params.type ?? "ALL"}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="VENDOR_TO_DGK">Vendor → DGK</SelectItem>
              <SelectItem value="DGK_TO_CUSTOMER">DGK → Customer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
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
        {(params.type || params.status) && (
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/invoices">Clear</Link>
          </Button>
        )}
      </form>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No invoices yet — generate one from a delivered delivery order.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {inv.type === "VENDOR_TO_DGK" ? "Vendor" : "Customer"}
                    </Badge>
                  </TableCell>
                  <TableCell>{inv.fromOrg.name}</TableCell>
                  <TableCell>{inv.toOrg.name}</TableCell>
                  <TableCell>{formatWIBDate(inv.issueDate)}</TableCell>
                  <TableCell>{formatWIBDate(inv.dueDate)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatIDR(inv.totalIDR)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={inv.status} />
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
