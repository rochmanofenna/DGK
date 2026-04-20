"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { transitionsForRole } from "@/lib/do-state-machine"
import type { DeliveryOrderStatus, UserRole } from "@/prisma/generated/enums"

import { updateDOStatusAction } from "../actions"

interface StatusActionsProps {
  deliveryOrderId: string
  currentStatus: DeliveryOrderStatus
  role: UserRole
}

/**
 * Renders only the transitions this role is allowed to perform. Reading
 * the same state-machine helper the server action uses keeps the render
 * layer and the authorization layer in sync — if they ever drift, the
 * state machine is the source of truth and one of the callers is wrong.
 */
export function StatusActions({
  deliveryOrderId,
  currentStatus,
  role,
}: StatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const buttons = transitionsForRole(currentStatus, role)
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
          disabled={isPending}
        >
          {isPending ? "Updating…" : b.label}
        </Button>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
