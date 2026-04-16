"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatIDR } from "@/lib/currency"
import { PaymentMethod } from "@/prisma/generated/enums"

import { recordPaymentAction } from "./actions"
import {
  INITIAL_RECORD_PAYMENT_STATE,
  PAYMENT_PROOF_ALLOWED_MIME,
  PAYMENT_PROOF_MAX_BYTES,
  type PaymentProofMime,
} from "./schemas"

interface PaymentFormProps {
  invoiceId: string
  remainingIDR: number
  canMutate: boolean
}

export function PaymentForm({
  invoiceId,
  remainingIDR,
  canMutate,
}: PaymentFormProps) {
  const [state, action, isPending] = useActionState(
    recordPaymentAction,
    INITIAL_RECORD_PAYMENT_STATE,
  )
  const [amount, setAmount] = useState<number | "">("")
  const [clientError, setClientError] = useState<string | null>(null)

  function onProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null)
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > PAYMENT_PROOF_MAX_BYTES) {
      setClientError(
        `${f.name}: ${(f.size / 1024 / 1024).toFixed(1)} MiB > 2 MiB`,
      )
      e.target.value = ""
      return
    }
    if (!PAYMENT_PROOF_ALLOWED_MIME.includes(f.type as PaymentProofMime)) {
      setClientError(`${f.name}: ${f.type || "unknown type"} not allowed`)
      e.target.value = ""
    }
  }

  if (!canMutate) {
    return (
      <p className="text-sm text-muted-foreground">
        Only Finance or Admin can record payments.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amountIDR">Amount (IDR)</Label>
          <Input
            id="amountIDR"
            name="amountIDR"
            type="number"
            min={1}
            step={1000}
            placeholder={`e.g. ${remainingIDR}`}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            required
          />
          <p className="text-xs text-muted-foreground">
            Remaining: <span className="font-mono">{formatIDR(remainingIDR)}</span>
            {typeof amount === "number" && amount > 0 && (
              <> · This payment: <span className="font-mono">{formatIDR(amount)}</span></>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentMethod">Method</Label>
          <Select name="paymentMethod" defaultValue={PaymentMethod.BANK_TRANSFER}>
            <SelectTrigger id="paymentMethod">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PaymentMethod.BANK_TRANSFER}>Bank transfer</SelectItem>
              <SelectItem value={PaymentMethod.QRIS}>QRIS</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="paidAt">Paid at</Label>
          <Input id="paidAt" name="paidAt" type="datetime-local" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referenceNumber">Reference # (optional)</Label>
          <Input
            id="referenceNumber"
            name="referenceNumber"
            placeholder="Bank ref or QRIS trx id"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="proof">
          Proof (optional, ≤ 2 MiB, JPG/PNG/WebP/PDF)
        </Label>
        <Input
          id="proof"
          name="proof"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onProofChange}
        />
      </div>

      {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="text-sm text-emerald-700">Payment recorded.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  )
}
