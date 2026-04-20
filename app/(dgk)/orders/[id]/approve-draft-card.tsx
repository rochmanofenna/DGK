"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatIDR } from "@/lib/currency"

import { approveDraftOrderAction } from "../actions"

interface ApproveDraftCardProps {
  orderId: string
  disabled: boolean
  disabledReason?: string
}

/**
 * "Approve & publish" panel for a customer-submitted DRAFT order.
 *
 * Shown only when `Order.status === DRAFT`. DGK sets the agreed price
 * and the action flips the status to SUBMITTED in one update. After
 * that the order is indistinguishable from a DGK-originated one and
 * flows through the normal Assign-vendor pipeline.
 */
export function ApproveDraftCard({
  orderId,
  disabled,
  disabledReason,
}: ApproveDraftCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [price, setPrice] = useState<string>("")
  const [serverError, setServerError] = useState<string | null>(null)

  const parsedPrice =
    price.trim() === "" ? NaN : Number(price.replace(/[^0-9]/g, ""))
  const valid = Number.isFinite(parsedPrice) && parsedPrice > 0

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!valid) return
    setServerError(null)
    startTransition(async () => {
      const result = await approveDraftOrderAction({
        orderId,
        customerPriceIDR: parsedPrice,
      })
      if (result.ok) {
        router.refresh()
      } else {
        setServerError(result.error)
      }
    })
  }

  return (
    <div className="rounded-md border-2 border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-700/40 dark:bg-amber-950/20">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Awaiting your review
        </h2>
        <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
          This order was submitted by the customer. Confirm the agreed price
          and publish it to move it into the dispatch queue.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="approve-price" className="text-xs font-medium">
            Customer price (IDR)
          </Label>
          <Input
            id="approve-price"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 4500000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={isPending || disabled}
          />
          <p className="text-xs text-muted-foreground">
            {valid
              ? formatIDR(parsedPrice)
              : "Enter the agreed price for this order."}
          </p>
        </div>

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!valid || isPending || disabled}
            title={disabled ? disabledReason : undefined}
          >
            {isPending ? "Publishing…" : "Approve & publish"}
          </Button>
        </div>
      </form>
    </div>
  )
}
