"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"

import { verifyPodAction } from "../actions"

interface VerifyPodButtonProps {
  deliveryOrderId: string
  canVerify: boolean
}

export function VerifyPodButton({ deliveryOrderId, canVerify }: VerifyPodButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onClick() {
    if (
      !confirm(
        "Confirm delivery verified? This flips the DO + Order to Delivered and cannot be undone.",
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await verifyPodAction(deliveryOrderId)
      if (result.ok) router.refresh()
      else setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        onClick={onClick}
        disabled={isPending || !canVerify}
        title={!canVerify ? "Ops Manager role required" : undefined}
      >
        {isPending ? "Verifying…" : "Verify POD"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
