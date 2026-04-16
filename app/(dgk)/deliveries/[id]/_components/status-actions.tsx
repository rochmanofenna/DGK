"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { STATUS_BUTTONS } from "@/lib/do-state-machine"
import type { DeliveryOrderStatus } from "@/prisma/generated/enums"

import { updateDOStatusAction } from "../actions"

interface StatusActionsProps {
  deliveryOrderId: string
  currentStatus: DeliveryOrderStatus
  canMutate: boolean
}

export function StatusActions({
  deliveryOrderId,
  currentStatus,
  canMutate,
}: StatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const buttons = STATUS_BUTTONS[currentStatus]
  if (buttons.length === 0) return null

  function onClick(to: DeliveryOrderStatus) {
    setError(null)
    startTransition(async () => {
      const result = await updateDOStatusAction({
        deliveryOrderId,
        newStatus: to,
      })
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buttons.map((b) => (
        <Button
          key={b.to}
          variant="outline"
          size="sm"
          onClick={() => onClick(b.to)}
          disabled={isPending || !canMutate}
          title={!canMutate ? "Ops Manager role required" : undefined}
        >
          {isPending ? "Updating…" : b.label}
        </Button>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
