"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { canTransition } from "@/lib/do-state-machine"
import { renderInvoicePDF } from "@/lib/pdf/invoice-pdf"
import { nextInvoiceNumber } from "@/lib/numbering"
import {
  INVOICE_FOLDER,
  POD_BUCKET,
  POD_FOLDER,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import { calculateInvoiceTotals } from "@/lib/tax"
import {
  DeliveryOrderStatus,
  InvoiceType,
  OrderStatus,
  type Region,
  type TruckType,
  UserRole,
} from "@/prisma/generated/enums"

import {
  createInvoiceSchema,
  logChecklistSchema,
  podMetadataSchema,
  POD_ALLOWED_MIME,
  POD_MAX_BYTES,
  POD_MAX_FILES,
  MIME_TO_EXT,
  updateStatusSchema,
  type CreateInvoiceValues,
  type LogChecklistValues,
  type PodMime,
  type PodUploadState,
  type UpdateStatusValues,
} from "./schemas"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const DO_MUTATION_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]
const INVOICE_CREATE_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.OPS_MANAGER,
  UserRole.FINANCE_ADMIN,
]

// Human labels used when baking data into the PDF. Small maps, duplicated
// from order-form.tsx because that file is a Client Component and the enum
// import path differs — keeping a local copy is cheaper than the shared
// extraction until a fourth consumer shows up.
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
const TRUCK_LABELS: Record<TruckType, string> = {
  CDEL_2T: "CDEL 2-ton",
  TRONTON_20T: "Tronton 20-ton",
}

// ─── Status transitions ──────────────────────────────────────────────────────

export async function updateDOStatusAction(
  input: UpdateStatusValues,
): Promise<ActionResult> {
  const parsed = updateStatusSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { deliveryOrderId, newStatus } = parsed.data

  const gate = await requireRole(DO_MUTATION_ROLES, "Your role can't update deliveries")
  if (!gate.ok) return gate

  const deliveryOrder = await db.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    select: { id: true, status: true },
  })
  if (!deliveryOrder) return { ok: false, error: "Delivery order not found" }

  if (!canTransition(deliveryOrder.status, newStatus)) {
    return {
      ok: false,
      error: `Can't transition from ${deliveryOrder.status} to ${newStatus}`,
    }
  }

  const data: { status: DeliveryOrderStatus; dispatchedAt?: Date } = {
    status: newStatus,
  }
  if (newStatus === DeliveryOrderStatus.DISPATCHED) {
    data.dispatchedAt = new Date()
  }

  await db.deliveryOrder.update({ where: { id: deliveryOrderId }, data })
  revalidatePath(`/deliveries/${deliveryOrderId}`)
  revalidatePath("/deliveries")
  return { ok: true, data: undefined }
}

// ─── Delivery checklist ──────────────────────────────────────────────────────

export async function logChecklistEntryAction(
  input: LogChecklistValues,
): Promise<ActionResult<{ id: string }>> {
  const parsed = logChecklistSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { deliveryOrderId, checkpoint, notes, photoUrl } = parsed.data

  const gate = await requireRole(DO_MUTATION_ROLES, "Your role can't log checkpoints")
  if (!gate.ok) return gate

  const exists = await db.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    select: { id: true },
  })
  if (!exists) return { ok: false, error: "Delivery order not found" }

  const entry = await db.deliveryChecklist.create({
    data: {
      deliveryOrderId,
      checkpoint,
      notes: notes ?? null,
      photoUrl: photoUrl ?? null,
      verifiedById: gate.session.user.id,
    },
    select: { id: true },
  })

  revalidatePath(`/deliveries/${deliveryOrderId}`)
  return { ok: true, data: { id: entry.id } }
}

// ─── POD upload ──────────────────────────────────────────────────────────────

export async function uploadPodAction(
  _prev: PodUploadState,
  formData: FormData,
): Promise<PodUploadState> {
  const gate = await requireRole(DO_MUTATION_ROLES, "Your role can't upload POD")
  if (!gate.ok) return { ok: false, error: gate.error }

  const parsedMeta = podMetadataSchema.safeParse({
    deliveryOrderId: formData.get("deliveryOrderId"),
    deliveredAt: formData.get("deliveredAt"),
    receiverName: formData.get("receiverName"),
    receiverSignatureUrl: formData.get("receiverSignatureUrl"),
    notes: formData.get("notes"),
  })
  if (!parsedMeta.success) {
    return {
      ok: false,
      error: parsedMeta.error.issues[0]?.message ?? "Invalid input",
    }
  }
  const meta = parsedMeta.data

  // Load DO + existing POD so we don't orphan an upload against a
  // cancelled DO or overwrite a verified POD silently.
  const deliveryOrder = await db.deliveryOrder.findUnique({
    where: { id: meta.deliveryOrderId },
    include: { proofOfDelivery: { select: { id: true, verifiedAt: true } } },
  })
  if (!deliveryOrder) return { ok: false, error: "Delivery order not found" }
  if (deliveryOrder.status !== DeliveryOrderStatus.DISPATCHED) {
    return {
      ok: false,
      error: `POD requires the delivery to be DISPATCHED (current: ${deliveryOrder.status})`,
    }
  }
  if (deliveryOrder.proofOfDelivery?.verifiedAt) {
    return { ok: false, error: "POD is already verified; uploads are locked" }
  }

  // ── File validation (server is authoritative; client checks are UX)
  const files = formData
    .getAll("photos")
    .filter((v): v is File => v instanceof File && v.size > 0)

  if (files.length === 0) {
    return { ok: false, error: "At least one photo is required" }
  }
  if (files.length > POD_MAX_FILES) {
    return { ok: false, error: `At most ${POD_MAX_FILES} photos per POD` }
  }
  for (const file of files) {
    if (file.size > POD_MAX_BYTES) {
      return { ok: false, error: `"${file.name}" exceeds ${POD_MAX_BYTES / 1024 / 1024} MiB` }
    }
    if (!POD_ALLOWED_MIME.includes(file.type as PodMime)) {
      return {
        ok: false,
        error: `"${file.name}" is ${file.type || "an unknown type"} — only JPEG/PNG/WebP accepted`,
      }
    }
  }

  // ── Upload each file. Path + extension are SERVER-GENERATED from the
  //    validated MIME, never from client-supplied filename (closes path
  //    traversal + ".exe.jpg" tricks).
  const uploadedUrls: string[] = []
  for (const file of files) {
    const ext = MIME_TO_EXT[file.type as PodMime]
    const key = `${POD_FOLDER}/${meta.deliveryOrderId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from(POD_BUCKET)
      .upload(key, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })
    if (upErr) {
      return {
        ok: false,
        error: `Upload failed for "${file.name}": ${upErr.message}`,
      }
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(POD_BUCKET)
      .getPublicUrl(key)
    uploadedUrls.push(publicUrlData.publicUrl)
  }

  // ── Create or replace the POD row (unverified PODs can be re-uploaded
  //    — e.g. vendor sent the wrong photos first time).
  await db.proofOfDelivery.upsert({
    where: { deliveryOrderId: meta.deliveryOrderId },
    create: {
      deliveryOrderId: meta.deliveryOrderId,
      uploadedById: gate.session.user.id,
      deliveredAt: meta.deliveredAt,
      receiverName: meta.receiverName,
      receiverSignatureUrl: meta.receiverSignatureUrl ?? null,
      photos: uploadedUrls,
      notes: meta.notes ?? null,
    },
    update: {
      uploadedById: gate.session.user.id,
      deliveredAt: meta.deliveredAt,
      receiverName: meta.receiverName,
      receiverSignatureUrl: meta.receiverSignatureUrl ?? null,
      photos: uploadedUrls,
      notes: meta.notes ?? null,
    },
  })

  revalidatePath(`/deliveries/${meta.deliveryOrderId}`)
  return { ok: true, error: null }
}

// ─── POD verification (terminal, triggers DELIVERED flips) ───────────────────

export async function verifyPodAction(
  deliveryOrderId: string,
): Promise<ActionResult> {
  const gate = await requireRole(DO_MUTATION_ROLES, "Your role can't verify POD")
  if (!gate.ok) return gate

  const deliveryOrder = await db.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    include: {
      proofOfDelivery: { select: { id: true, verifiedAt: true, deliveredAt: true } },
    },
  })
  if (!deliveryOrder) return { ok: false, error: "Delivery order not found" }
  if (deliveryOrder.status !== DeliveryOrderStatus.DISPATCHED) {
    return {
      ok: false,
      error: `Verification requires DISPATCHED status (current: ${deliveryOrder.status})`,
    }
  }
  if (!deliveryOrder.proofOfDelivery) {
    return { ok: false, error: "No POD on file yet" }
  }
  if (deliveryOrder.proofOfDelivery.verifiedAt) {
    return { ok: false, error: "POD is already verified" }
  }

  // Transaction: stamp POD + flip DO + flip parent Order, atomically.
  // TODO(phase-2): when an Order can have multiple DOs, only flip Order.status
  // to DELIVERED when ALL sibling DOs are DELIVERED. For MVP (1 DO per Order)
  // the flip is unconditional.
  await db.$transaction(async (tx) => {
    await tx.proofOfDelivery.update({
      where: { deliveryOrderId },
      data: {
        verifiedByDgkId: gate.session.user.id,
        verifiedAt: new Date(),
      },
    })
    await tx.deliveryOrder.update({
      where: { id: deliveryOrderId },
      data: {
        status: DeliveryOrderStatus.DELIVERED,
        deliveredAt: deliveryOrder.proofOfDelivery!.deliveredAt,
      },
    })
    await tx.order.update({
      where: { id: deliveryOrder.orderId },
      data: { status: OrderStatus.DELIVERED },
    })
  })

  revalidatePath(`/deliveries/${deliveryOrderId}`)
  revalidatePath(`/orders/${deliveryOrder.orderId}`)
  revalidatePath("/deliveries")
  revalidatePath("/orders")
  return { ok: true, data: undefined }
}

// ─── Invoice creation (vendor→DGK or DGK→customer) ───────────────────────────

/** True iff `err` is a Prisma P2002 unique-constraint violation on `invoiceNumber`. */
function isInvoiceNumberConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false
  const e = err as { code?: unknown; meta?: { target?: unknown } }
  if (e.code !== "P2002") return false
  const target = e.meta?.target
  return Array.isArray(target) && target.length === 1 && target[0] === "invoiceNumber"
}

export async function createInvoiceAction(
  input: CreateInvoiceValues,
): Promise<ActionResult<{ invoiceId: string }>> {
  const parsed = createInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const { deliveryOrderId, type } = parsed.data

  const gate = await requireRole(
    INVOICE_CREATE_ROLES,
    "Your role can't generate invoices",
  )
  if (!gate.ok) return gate

  // Load everything we need for the PDF and the invoice row in one shot.
  const deliveryOrder = await db.deliveryOrder.findUnique({
    where: { id: deliveryOrderId },
    include: {
      order: {
        include: {
          customer: { include: { organization: true } },
        },
      },
      vendor: { include: { organization: true } },
      proofOfDelivery: { select: { verifiedAt: true } },
      invoices: { select: { id: true, type: true } },
    },
  })
  if (!deliveryOrder) return { ok: false, error: "Delivery order not found" }
  if (deliveryOrder.status !== DeliveryOrderStatus.DELIVERED) {
    return {
      ok: false,
      error: `Invoice requires DELIVERED status (current: ${deliveryOrder.status})`,
    }
  }
  if (!deliveryOrder.proofOfDelivery?.verifiedAt) {
    return { ok: false, error: "POD must be verified before invoicing" }
  }
  if (deliveryOrder.invoices.some((inv) => inv.type === type)) {
    return {
      ok: false,
      error: `A ${type === InvoiceType.VENDOR_TO_DGK ? "vendor" : "customer"} invoice already exists for this delivery`,
    }
  }

  const dgkOrg = await db.organization.findFirst({ where: { type: "DGK" } })
  if (!dgkOrg) {
    return { ok: false, error: "DGK organization not found (seed missing?)" }
  }

  // Determine fromOrg / toOrg / subtotal / dueDate from invoice type.
  const now = new Date()
  let fromOrg: typeof dgkOrg
  let toOrg: typeof dgkOrg
  let subtotalIDR: number
  let paymentTermsDays: number

  if (type === InvoiceType.VENDOR_TO_DGK) {
    fromOrg = deliveryOrder.vendor.organization
    toOrg = dgkOrg
    subtotalIDR = deliveryOrder.vendorPriceIDR
    paymentTermsDays = deliveryOrder.vendor.paymentTermsDays
  } else {
    // DGK_TO_CUSTOMER
    if (deliveryOrder.order.customerPriceIDR == null) {
      return {
        ok: false,
        error: "Order's customer price is not set — update the order first",
      }
    }
    fromOrg = dgkOrg
    toOrg = deliveryOrder.order.customer.organization
    subtotalIDR = deliveryOrder.order.customerPriceIDR
    const customer = await db.customer.findUnique({
      where: { id: deliveryOrder.order.customerId },
      select: { creditTermsDays: true },
    })
    if (!customer) return { ok: false, error: "Customer not found" }
    paymentTermsDays = customer.creditTermsDays
  }

  const { tax: taxIDR, total: totalIDR } = calculateInvoiceTotals(subtotalIDR)
  const dueDate = new Date(now)
  dueDate.setDate(dueDate.getDate() + paymentTermsDays)

  // "to" instead of "→" — the Unicode arrow isn't in Helvetica's core glyph
  // set and renders as a fallback apostrophe in the PDF. Plain ASCII "to"
  // reads more naturally on a formal invoice than "->" anyway.
  const route = `${REGION_LABELS[deliveryOrder.order.originRegion]} to ${REGION_LABELS[deliveryOrder.order.destinationRegion]}`
  const truckTypeLabel = TRUCK_LABELS[deliveryOrder.order.requiredTruckType]

  // Retry on invoiceNumber collision only. Each attempt re-renders + re-uploads
  // against a fresh number; a prior-attempt PDF becomes orphaned in Storage
  // (flagged for phase-2 GC in DECISIONS.md).
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoiceNumber = await nextInvoiceNumber()

      const pdfBuffer = await renderInvoicePDF({
        invoiceNumber,
        type,
        issueDate: now,
        dueDate,
        fromOrg: {
          name: fromOrg.name,
          address: fromOrg.address,
          taxId: fromOrg.taxId,
          bankName: fromOrg.bankName,
          bankAccount: fromOrg.bankAccount,
        },
        toOrg: {
          name: toOrg.name,
          address: toOrg.address,
          taxId: toOrg.taxId,
        },
        subtotalIDR,
        taxIDR,
        totalIDR,
        paymentTermsDays,
        orderNumber: deliveryOrder.order.orderNumber,
        doNumber: deliveryOrder.doNumber,
        route,
        truckTypeLabel,
      })

      // Timestamp suffix so orphaned PDFs from prior runs (e.g. after a
       // demo reset that wipes DB rows but not Storage) don't block
       // re-use of the same invoice number. The canonical PDF for a given
       // invoice is always the one referenced by Invoice.pdfUrl.
      const storageKey = `${INVOICE_FOLDER}/${invoiceNumber}-${Date.now()}.pdf`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(POD_BUCKET)
        .upload(storageKey, pdfBuffer, {
          contentType: "application/pdf",
          cacheControl: "3600",
          upsert: false,
        })
      if (uploadErr) {
        return { ok: false, error: `PDF upload failed: ${uploadErr.message}` }
      }
      const { data: urlData } = supabaseAdmin.storage
        .from(POD_BUCKET)
        .getPublicUrl(storageKey)
      const pdfUrl = urlData.publicUrl

      const result = await db.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber,
            type,
            fromOrgId: fromOrg.id,
            toOrgId: toOrg.id,
            deliveryOrderId: deliveryOrder.id,
            issueDate: now,
            dueDate,
            subtotalIDR,
            taxIDR,
            totalIDR,
            status: "DRAFT",
            pdfUrl,
          },
          select: { id: true },
        })

        // If both VENDOR_TO_DGK and DGK_TO_CUSTOMER now exist for this DO's
        // parent order, flip Order.status to INVOICED. TODO(phase-2): for
        // multi-DO orders, check all DOs have both invoices before flipping.
        const existingTypes = await tx.invoice.findMany({
          where: { deliveryOrder: { orderId: deliveryOrder.orderId } },
          select: { type: true },
          distinct: ["type"],
        })
        if (existingTypes.length === 2) {
          await tx.order.update({
            where: { id: deliveryOrder.orderId },
            data: { status: OrderStatus.INVOICED },
          })
        }

        return invoice
      })

      revalidatePath(`/deliveries/${deliveryOrder.id}`)
      revalidatePath(`/orders/${deliveryOrder.orderId}`)
      revalidatePath("/invoices")
      revalidatePath("/orders")
      return { ok: true, data: { invoiceId: result.id } }
    } catch (err) {
      lastError = err
      if (isInvoiceNumberConflict(err)) continue
      throw err
    }
  }
  throw lastError
}
