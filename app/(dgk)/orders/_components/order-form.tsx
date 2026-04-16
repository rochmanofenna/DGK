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
import { formatIDR } from "@/lib/currency"
import { Region, TruckType } from "@/prisma/generated/enums"

import { createOrderAction } from "../actions"
import { orderFormSchema, type OrderFormValues } from "../schemas"

import { PackingListEditor } from "./packing-list-editor"

interface OrderFormProps {
  customers: { id: string; name: string }[]
}

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

export function OrderForm({ customers }: OrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      customerId: "",
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
      // Empty string cast — RHF's `number`-typed field starts unset so the
      // input renders the placeholder instead of a literal "0" the user has
      // to delete. Zod's `.positive()` still enforces required-at-submit.
      customerPriceIDR: undefined as unknown as number,
      notes: "",
    },
  })

  function onSubmit(values: OrderFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createOrderAction(values)
      if (result.ok) {
        router.push(`/orders/${result.data.orderId}`)
        router.refresh()
      } else {
        setServerError(result.error)
      }
    })
  }

  const customerPriceIDR = form.watch("customerPriceIDR")

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
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
            name="pickupDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pickup date</FormLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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
                <FormLabel>Origin address</FormLabel>
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
                <FormLabel>Destination address</FormLabel>
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
          name="customerPriceIDR"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer price (IDR)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 4500000"
                  value={field.value ?? ""}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? undefined : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
              <FormDescription>
                {typeof customerPriceIDR === "number" && customerPriceIDR > 0
                  ? formatIDR(customerPriceIDR)
                  : "Enter the agreed price for this order."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Optional context for Ops or the vendor"
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
            {isPending ? "Creating…" : "Create order"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
