import { z } from "zod"

import { PaymentMethod } from "@/prisma/generated/enums"

// ─── Payment proof (optional file) validation constants ─────────────────────
export const PAYMENT_PROOF_MAX_BYTES = 2 * 1024 * 1024 // 2 MiB

export const PAYMENT_PROOF_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const
export type PaymentProofMime = (typeof PAYMENT_PROOF_ALLOWED_MIME)[number]

export const MIME_TO_EXT: Record<PaymentProofMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
}

// ─── Payment form state (used by useActionState) ────────────────────────────
// Lives here rather than actions.ts because Next 16 strict `"use server"`
// forbids non-async exports — same invariant we hit in Module 7.
export interface RecordPaymentState {
  ok: boolean
  error: string | null
}
export const INITIAL_RECORD_PAYMENT_STATE: RecordPaymentState = {
  ok: false,
  error: null,
}

// ─── Action payload (parsed from FormData by the action) ────────────────────
// Payment proof File is handled separately in the action body; metadata
// fields are parsed with this schema.
export const recordPaymentMetaSchema = z.object({
  invoiceId: z.string().trim().min(1),
  amountIDR: z.coerce.number().int().positive("Amount must be > 0"),
  paymentMethod: z.nativeEnum(PaymentMethod),
  paidAt: z.coerce.date(),
  referenceNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
})
export type RecordPaymentMetaValues = z.infer<typeof recordPaymentMetaSchema>
