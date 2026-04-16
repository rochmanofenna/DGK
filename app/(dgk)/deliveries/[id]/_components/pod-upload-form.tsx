"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { uploadPodAction } from "../actions"
import {
  INITIAL_POD_UPLOAD_STATE,
  POD_ALLOWED_MIME,
  POD_MAX_BYTES,
  POD_MAX_FILES,
  type PodMime,
} from "../schemas"

interface PodUploadFormProps {
  deliveryOrderId: string
  canMutate: boolean
}

export function PodUploadForm({ deliveryOrderId, canMutate }: PodUploadFormProps) {
  const [state, action, isPending] = useActionState(
    uploadPodAction,
    INITIAL_POD_UPLOAD_STATE,
  )
  const [clientError, setClientError] = useState<string | null>(null)
  const [validCount, setValidCount] = useState(0)

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null)
    const picked = Array.from(e.target.files ?? [])
    if (picked.length === 0) {
      setValidCount(0)
      return
    }
    if (picked.length > POD_MAX_FILES) {
      setClientError(`At most ${POD_MAX_FILES} photos per POD`)
      setValidCount(0)
      return
    }
    const errors: string[] = []
    let valid = 0
    for (const f of picked) {
      if (f.size > POD_MAX_BYTES) {
        errors.push(`${f.name}: ${(f.size / 1024 / 1024).toFixed(1)} MiB > 2 MiB`)
      } else if (!POD_ALLOWED_MIME.includes(f.type as PodMime)) {
        errors.push(`${f.name}: ${f.type || "unknown type"} not allowed`)
      } else {
        valid++
      }
    }
    if (errors.length > 0) setClientError(errors.join("; "))
    setValidCount(valid)
  }

  if (!canMutate) {
    return (
      <p className="text-sm text-muted-foreground">
        Only Ops Manager or Admin can upload POD.
      </p>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="deliveryOrderId" value={deliveryOrderId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deliveredAt">Delivered at</Label>
          <Input
            id="deliveredAt"
            name="deliveredAt"
            type="datetime-local"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receiverName">Receiver name</Label>
          <Input id="receiverName" name="receiverName" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">Photos (up to 5, JPEG/PNG/WebP, ≤ 2 MiB each)</Label>
        <Input
          id="photos"
          name="photos"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={onFilesChange}
          required
        />
        {validCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {validCount} file{validCount === 1 ? "" : "s"} ready to upload
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="receiverSignatureUrl">Signature URL (optional)</Label>
        <Input
          id="receiverSignatureUrl"
          name="receiverSignatureUrl"
          type="url"
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="text-sm text-emerald-700">POD uploaded.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Uploading…" : "Upload POD"}
        </Button>
      </div>
    </form>
  )
}
