"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-helpers"
import { formatIDR } from "@/lib/currency"
import { db } from "@/lib/db"
import {
  PAYMENT_PROOF_FOLDER,
  POD_BUCKET,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import {
  InvoiceStatus,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "@/prisma/generated/enums"

import {
  MIME_TO_EXT,
  PAYMENT_PROOF_ALLOWED_MIME,
  PAYMENT_PROOF_MAX_BYTES,
  recordPaymentMetaSchema,
  type PaymentProofMime,
  type RecordPaymentState,
} from "./schemas"

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

/**
 * Record a payment against an invoice, with optional proof upload. Handles:
 *   - role gate (FINANCE_ADMIN / ADMIN only — ops doesn't book cash)
 *   - overpayment guard: new amount + prior CONFIRMED must ≤ invoice total,
 *     error message shows remaining balance so the user knows what to enter
 *   - optional single-file proof (JPG/PNG/WebP/PDF, ≤ 2 MiB) uploaded via
 *     the same service-role pattern as POD photos
 *   - transactional cascade: if sum of confirmed payments hits invoice
 *     total, flip Invoice.status → PAID; if BOTH invoice types for this
 *     DO's parent order are PAID, flip Order.status → PAID (terminal).
 */
export async function recordPaymentAction(
  _prev: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const gate = await requireRole(
    INVOICE_MUTATION_ROLES,
    "Your role can't record payments",
  )
  if (!gate.ok) return { ok: false, error: gate.error }

  const parsed = recordPaymentMetaSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amountIDR: formData.get("amountIDR"),
    paymentMethod: formData.get("paymentMethod"),
    paidAt: formData.get("paidAt"),
    referenceNumber: formData.get("referenceNumber"),
  })
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }
  const meta = parsed.data

  const invoice = await db.invoice.findUnique({
    where: { id: meta.invoiceId },
    select: {
      id: true,
      status: true,
      totalIDR: true,
      deliveryOrder: { select: { orderId: true } },
    },
  })
  if (!invoice) return { ok: false, error: "Invoice not found" }
  if (invoice.status === InvoiceStatus.PAID) {
    return { ok: false, error: "Invoice is already fully paid" }
  }
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return {
      ok: false,
      error: "Cannot record payment against a cancelled invoice",
    }
  }

  // Overpayment guard — sum prior CONFIRMED, compute remaining, reject if over.
  const priorAgg = await db.payment.aggregate({
    where: { invoiceId: invoice.id, status: PaymentStatus.CONFIRMED },
    _sum: { amountIDR: true },
  })
  const priorPaid = priorAgg._sum.amountIDR ?? 0
  const remaining = invoice.totalIDR - priorPaid
  if (meta.amountIDR > remaining) {
    return {
      ok: false,
      error: `Payment of ${formatIDR(meta.amountIDR)} would exceed invoice total of ${formatIDR(invoice.totalIDR)}. Remaining balance is ${formatIDR(remaining)}.`,
    }
  }

  // Optional proof file — path server-generated from validated MIME, filename
  // never touched (same hardening as POD photos in Module 7).
  const proofFile = formData.get("proof")
  let proofUrl: string | null = null
  if (proofFile instanceof File && proofFile.size > 0) {
    if (proofFile.size > PAYMENT_PROOF_MAX_BYTES) {
      return {
        ok: false,
        error: `"${proofFile.name}" exceeds ${PAYMENT_PROOF_MAX_BYTES / 1024 / 1024} MiB`,
      }
    }
    if (!PAYMENT_PROOF_ALLOWED_MIME.includes(proofFile.type as PaymentProofMime)) {
      return {
        ok: false,
        error: `"${proofFile.name}" is ${proofFile.type || "an unknown type"} — only JPEG/PNG/WebP/PDF accepted`,
      }
    }
    const ext = MIME_TO_EXT[proofFile.type as PaymentProofMime]
    const key = `${PAYMENT_PROOF_FOLDER}/${invoice.id}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await proofFile.arrayBuffer())
    const { error: upErr } = await supabaseAdmin.storage
      .from(POD_BUCKET)
      .upload(key, buffer, {
        contentType: proofFile.type,
        cacheControl: "3600",
        upsert: false,
      })
    if (upErr) {
      return { ok: false, error: `Proof upload failed: ${upErr.message}` }
    }
    const { data: pub } = supabaseAdmin.storage
      .from(POD_BUCKET)
      .getPublicUrl(key)
    proofUrl = pub.publicUrl
  }

  // Transaction: create Payment + cascade both possible flips atomically.
  await db.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        amountIDR: meta.amountIDR,
        paymentMethod: meta.paymentMethod,
        referenceNumber: meta.referenceNumber ?? null,
        paidAt: meta.paidAt,
        recordedById: gate.session.user.id,
        proofUrl,
        status: PaymentStatus.CONFIRMED,
      },
    })

    const newAgg = await tx.payment.aggregate({
      where: { invoiceId: invoice.id, status: PaymentStatus.CONFIRMED },
      _sum: { amountIDR: true },
    })
    const newTotal = newAgg._sum.amountIDR ?? 0

    // >= not === to be float-safe (we only use ints, but cheap insurance).
    if (newTotal >= invoice.totalIDR) {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.PAID },
      })

      // Both VENDOR_TO_DGK and DGK_TO_CUSTOMER paid for this DO's parent
      // order? → flip Order.status → PAID (terminal).
      // TODO(phase-2): multi-DO orders need "all DOs have both invoices
      // PAID" — MVP 1:1 makes this check correct as-is.
      const paidTypes = await tx.invoice.findMany({
        where: {
          deliveryOrder: { orderId: invoice.deliveryOrder.orderId },
          status: InvoiceStatus.PAID,
        },
        select: { type: true },
        distinct: ["type"],
      })
      if (paidTypes.length === 2) {
        await tx.order.update({
          where: { id: invoice.deliveryOrder.orderId },
          data: { status: OrderStatus.PAID },
        })
      }
    }
  })

  revalidatePath(`/invoices/${invoice.id}`)
  revalidatePath("/invoices")
  revalidatePath("/payments")
  revalidatePath(`/orders/${invoice.deliveryOrder.orderId}`)
  revalidatePath("/orders")
  return { ok: true, error: null }
}
