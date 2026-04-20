"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Region, TruckType } from "@/prisma/generated/enums"

import { submitCustomerOrderAction } from "../actions"
import {
  customerOrderSubmissionSchema,
  type CustomerOrderSubmissionValues,
} from "../schema"

import { PackingListEditor } from "./packing-list-editor"

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
  CDEL_2T: "CDEL (2-ton chilled/frozen)",
  TRONTON_20T: "Tronton (20-ton chilled/frozen)",
}

function todayForInput(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function CustomerOrderForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CustomerOrderSubmissionValues>({
    resolver: zodResolver(customerOrderSubmissionSchema),
    defaultValues: {
      pickupDate: todayForInput(),
      originRegion: Region.SENTUL_CILEUNGSI_NAROGONG,
      destinationRegion: Region.JAKARTA,
      originAddress: "",
      destinationAddress: "",
      requiredTruckType: TruckType.CDEL_2T,
      manifestDescription: "",
      packingList: {
        items: [{ description: "", quantity: 1, unit: "pcs", weightKg: null }],
      },
      notes: "",
    },
  })

  function onSubmit(values: CustomerOrderSubmissionValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await submitCustomerOrderAction(values)
      if (result.ok) {
        router.push(`/portal/orders/${result.data.orderId}`)
        router.refresh()
      } else {
        setServerError(result.error)
      }
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="pickupDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Requested pickup date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  value={
                    field.value instanceof Date
                      ? field.value.toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) => field.onChange(new Date(e.target.value))}
                />
              </FormControl>
              <FormDescription>
                DGK will confirm the final pickup time when the request is
                approved.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="originRegion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origin region</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(Region).map((r) => (
                      <SelectItem key={r} value={r}>
                        {REGION_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destinationRegion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination region</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.values(Region).map((r) => (
                      <SelectItem key={r} value={r}>
                        {REGION_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="originAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pickup address</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Street, city, postcode"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="destinationAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery address</FormLabel>
                <FormControl>
                  <Textarea
                    rows={2}
                    placeholder="Street, city, postcode"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="requiredTruckType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Required truck type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.values(TruckType).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRUCK_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="manifestDescription"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manifest description</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="What's being shipped — high-level"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Packing list</FormLabel>
          <FormDescription>
            Line-by-line inventory. At least one item required.
          </FormDescription>
          <PackingListEditor control={form.control} />
          {form.formState.errors.packingList?.items?.root?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.packingList.items.root.message}
            </p>
          )}
        </FormItem>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes for DGK</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Special handling, contact at delivery, etc."
                  value={field.value ?? ""}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <div className="rounded-md border border-[color:var(--brand-blue)]/25 bg-[color:var(--brand-blue)]/5 p-3 text-xs text-muted-foreground">
          After submission DGK will review your request, confirm the price,
          and advance it for dispatch. You&apos;ll see pricing and status
          updates on the order detail page.
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
