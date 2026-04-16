"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { DeliveryCheckpoint } from "@/prisma/generated/enums"

import { logChecklistEntryAction } from "../actions"

const CHECKPOINT_LABELS: Record<DeliveryCheckpoint, string> = {
  PICKUP: "Pickup",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  UNLOADING: "Unloading",
  COMPLETED: "Completed",
}

interface ChecklistFormProps {
  deliveryOrderId: string
  canMutate: boolean
}

export function ChecklistForm({ deliveryOrderId, canMutate }: ChecklistFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [checkpoint, setCheckpoint] = useState<DeliveryCheckpoint>(
    DeliveryCheckpoint.PICKUP,
  )
  const [notes, setNotes] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await logChecklistEntryAction({
        deliveryOrderId,
        checkpoint,
        notes: notes.trim() || null,
        photoUrl: photoUrl.trim() || null,
      })
      if (result.ok) {
        setOpen(false)
        setNotes("")
        setPhotoUrl("")
        setCheckpoint(DeliveryCheckpoint.PICKUP)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!canMutate}
          title={!canMutate ? "Ops Manager role required" : undefined}
        >
          + Add checkpoint
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log checkpoint</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="checkpoint">Checkpoint</Label>
            <Select
              value={checkpoint}
              onValueChange={(v) => setCheckpoint(v as DeliveryCheckpoint)}
            >
              <SelectTrigger id="checkpoint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(DeliveryCheckpoint).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHECKPOINT_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="photoUrl">Photo URL (optional)</Label>
            <Input
              id="photoUrl"
              type="url"
              placeholder="https://..."
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Log"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
