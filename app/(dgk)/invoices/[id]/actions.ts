"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { InvoiceStatus, UserRole } from "@/prisma/generated/enums"

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const INVOICE_MUTATION_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.FINANCE_ADMIN,
]

export async function markInvoiceSentAction(
  invoiceId: string,
): Promise<ActionResult> {
  const gate = await requireRole(
    INVOICE_MUTATION_ROLES,
    "Your role can't update invoices",
  )
  if (!gate.ok) return gate

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true },
  })
  if (!invoice) return { ok: false, error: "Invoice not found" }
  if (invoice.status !== InvoiceStatus.DRAFT) {
    return {
      ok: false,
      error: `Invoice is already ${invoice.status.toLowerCase()}`,
    }
  }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: InvoiceStatus.SENT },
  })

  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath("/invoices")
  return { ok: true, data: undefined }
}
