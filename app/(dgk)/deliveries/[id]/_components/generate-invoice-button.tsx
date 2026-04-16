"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import type { InvoiceType } from "@/prisma/generated/enums"

import { createInvoiceAction } from "../actions"

interface GenerateInvoiceButtonProps {
  deliveryOrderId: string
  type: InvoiceType
  label: string
  canMutate: boolean
  alreadyExists: boolean
}

export function GenerateInvoiceButton({
  deliveryOrderId,
  type,
  label,
  canMutate,
  alreadyExists,
}: GenerateInvoiceButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const disabled = !canMutate || alreadyExists || isPending
  const title = alreadyExists
    ? "Already generated"
    : !canMutate
      ? "Finance or Ops role required"
      : undefined

  function onClick() {
    setError(null)
    startTransition(async () => {
      const result = await createInvoiceAction({ deliveryOrderId, type })
      if (result.ok) {
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        {isPending ? "Generating…" : alreadyExists ? `${label} ✓` : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
