"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth-helpers"
import { db } from "@/lib/db"
import { canTransition } from "@/lib/do-state-machine"
import {
  POD_BUCKET,
  POD_FOLDER,
  supabaseAdmin,
} from "@/lib/supabase-admin"
import {
  DeliveryOrderStatus,
  OrderStatus,
  UserRole,
} from "@/prisma/generated/enums"

import {
  logChecklistSchema,
  podMetadataSchema,
  POD_ALLOWED_MIME,
  POD_MAX_BYTES,
  POD_MAX_FILES,
  MIME_TO_EXT,
  updateStatusSchema,
  type LogChecklistValues,
  type PodMime,
  type UpdateStatusValues,
} from "./schemas"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const DO_MUTATION_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.OPS_MANAGER]

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

export interface PodUploadState {
  ok: boolean
  error: string | null
}

export const INITIAL_POD_UPLOAD_STATE: PodUploadState = { ok: false, error: null }

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
