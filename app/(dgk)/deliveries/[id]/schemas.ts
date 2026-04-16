import { z } from "zod"

import { DeliveryCheckpoint, DeliveryOrderStatus } from "@/prisma/generated/enums"

// ─── File validation constants (used by client + server) ─────────────────────
export const POD_MAX_FILES = 5
export const POD_MAX_BYTES = 2 * 1024 * 1024 // 2 MiB

export const POD_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const
export type PodMime = (typeof POD_ALLOWED_MIME)[number]

export const MIME_TO_EXT: Record<PodMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

// ─── Action payloads ─────────────────────────────────────────────────────────

export const updateStatusSchema = z.object({
  deliveryOrderId: z.string().trim().min(1),
  newStatus: z.nativeEnum(DeliveryOrderStatus),
})
export type UpdateStatusValues = z.infer<typeof updateStatusSchema>

export const logChecklistSchema = z.object({
  deliveryOrderId: z.string().trim().min(1),
  checkpoint: z.nativeEnum(DeliveryCheckpoint),
  notes: z.string().trim().max(1000).optional().nullable(),
  photoUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
})
export type LogChecklistValues = z.infer<typeof logChecklistSchema>

// POD upload receives FormData (Files + metadata together). The metadata
// half is parsed with this schema; the Files are validated separately by
// the action body using the constants above.
export const podMetadataSchema = z.object({
  deliveryOrderId: z.string().trim().min(1),
  deliveredAt: z.coerce.date(),
  receiverName: z.string().trim().min(1, "Receiver name is required"),
  receiverSignatureUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  notes: z.string().trim().max(1000).optional().nullable(),
})
export type PodMetadataValues = z.infer<typeof podMetadataSchema>
