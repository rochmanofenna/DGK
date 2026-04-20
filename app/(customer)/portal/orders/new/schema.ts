import { z } from "zod"

import {
  packingItemSchema,
  PACKING_UNITS,
  type PackingUnit,
} from "@/app/(dgk)/orders/schemas"
import { Region, TruckType } from "@/prisma/generated/enums"

// Re-exports so the customer portal doesn't reach cross-route for these.
export { PACKING_UNITS }
export type { PackingUnit }

/**
 * Customer-submitted shipping request. Fewer fields than the DGK form:
 *
 *   - `customerId` is inferred from the session — the customer can only
 *     create orders for their own organization.
 *   - `customerPriceIDR` is absent — DGK reviews the request and sets
 *     the agreed price before advancing DRAFT → SUBMITTED.
 *
 * Everything else mirrors the DGK schema exactly so a customer-submitted
 * DRAFT can flow through the same downstream code (assignment, delivery,
 * invoicing) without special-casing.
 */
export const customerOrderSubmissionSchema = z
  .object({
    pickupDate: z.date(),
    originRegion: z.nativeEnum(Region),
    destinationRegion: z.nativeEnum(Region),
    originAddress: z.string().trim().min(1, "Origin address is required"),
    destinationAddress: z
      .string()
      .trim()
      .min(1, "Destination address is required"),
    requiredTruckType: z.nativeEnum(TruckType),
    manifestDescription: z.string().trim().min(1, "Manifest is required"),
    packingList: z.object({
      items: z.array(packingItemSchema).min(1, "Add at least one packing line"),
    }),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => data.originRegion !== data.destinationRegion, {
    message: "Origin and destination must differ",
    path: ["destinationRegion"],
  })

export type CustomerOrderSubmissionValues = z.infer<
  typeof customerOrderSubmissionSchema
>
