import { z } from "zod"

import { Region, TruckType } from "@/prisma/generated/enums"

export const PACKING_UNITS = ["kg", "pcs", "crate", "pallet", "box", "liter"] as const
export type PackingUnit = (typeof PACKING_UNITS)[number]

export const packingItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().int().positive("Quantity must be > 0"),
  unit: z.enum(PACKING_UNITS),
  weightKg: z.number().positive().nullable().optional(),
})

export const orderFormSchema = z
  .object({
    customerId: z.string().trim().min(1, "Select a customer"),
    pickupDate: z.date(),
    originRegion: z.nativeEnum(Region),
    destinationRegion: z.nativeEnum(Region),
    originAddress: z.string().trim().min(1, "Origin address is required"),
    destinationAddress: z.string().trim().min(1, "Destination address is required"),
    requiredTruckType: z.nativeEnum(TruckType),
    manifestDescription: z.string().trim().min(1, "Manifest is required"),
    packingList: z.object({
      items: z.array(packingItemSchema).min(1, "Add at least one packing line"),
    }),
    customerPriceIDR: z.number().int().positive("Price must be > 0"),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((data) => data.originRegion !== data.destinationRegion, {
    message: "Origin and destination must differ",
    path: ["destinationRegion"],
  })

export type OrderFormValues = z.infer<typeof orderFormSchema>
export type PackingItem = z.infer<typeof packingItemSchema>

export const assignVendorSchema = z.object({
  orderId: z.string().trim().min(1),
  rateCardEntryId: z.string().trim().min(1),
})
export type AssignVendorValues = z.infer<typeof assignVendorSchema>
