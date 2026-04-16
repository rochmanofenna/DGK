"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatIDR } from "@/lib/currency"
import { formatWIBDate } from "@/lib/time"
import { cn } from "@/lib/utils"

import { createDeliveryOrderAction } from "../actions"

export interface VendorCandidateView {
  rateCardEntryId: string
  vendorName: string
  priceIDR: number
  effectiveDate: Date
}

interface AssignVendorDialogProps {
  orderId: string
  routeLabel: string
  truckLabel: string
  candidates: VendorCandidateView[]
  disabled: boolean
  disabledReason?: string
}

export function AssignVendorDialog({
  orderId,
  routeLabel,
  truckLabel,
  candidates,
  disabled,
  disabledReason,
}: AssignVendorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(
    candidates[0]?.rateCardEntryId ?? null,
  )
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onConfirm() {
    if (!selectedEntryId) return
    setServerError(null)
    startTransition(async () => {
      const result = await createDeliveryOrderAction({
        orderId,
        rateCardEntryId: selectedEntryId,
      })
      if (result.ok) {
        // Close on success — the re-render will show the new DO.
        setOpen(false)
        router.refresh()
      } else {
        // Keep dialog open on failure so the user can see what went wrong.
        // Auto-closing here would drop them back on a stale order detail
        // page with no indication anything happened.
        setServerError(result.error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        setOpen(next)
        if (!next) setServerError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          Assign vendor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign vendor</DialogTitle>
          <DialogDescription>
            {routeLabel} · {truckLabel}
          </DialogDescription>
        </DialogHeader>

        {candidates.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No active rate card covers this route.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => {
              const selected = c.rateCardEntryId === selectedEntryId
              return (
                <button
                  key={c.rateCardEntryId}
                  type="button"
                  onClick={() => setSelectedEntryId(c.rateCardEntryId)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-muted/50"
                      : "hover:bg-muted/30",
                  )}
                >
                  <div>
                    <div className="font-medium">{c.vendorName}</div>
                    <div className="text-xs text-muted-foreground">
                      Rate card effective {formatWIBDate(c.effectiveDate)}
                    </div>
                  </div>
                  <div className="font-mono text-sm">{formatIDR(c.priceIDR)}</div>
                </button>
              )
            })}
          </div>
        )}

        {serverError && (
          <p className="text-sm text-destructive">{serverError}</p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={
              isPending || !selectedEntryId || candidates.length === 0
            }
          >
            {isPending ? "Assigning…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
