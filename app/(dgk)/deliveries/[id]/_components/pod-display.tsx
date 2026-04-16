import { formatWIBDateTime } from "@/lib/time"

interface PodDisplayProps {
  pod: {
    deliveredAt: Date
    receiverName: string
    receiverSignatureUrl: string | null
    photos: string[]
    notes: string | null
    verifiedAt: Date | null
    verifiedByDgk: { name: string } | null
    uploadedBy: { name: string }
    createdAt: Date
  }
}

export function PodDisplay({ pod }: PodDisplayProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">Delivered at:</span>{" "}
          <span className="font-medium">{formatWIBDateTime(pod.deliveredAt)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Received by:</span>{" "}
          <span className="font-medium">{pod.receiverName}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Uploaded {formatWIBDateTime(pod.createdAt)} by {pod.uploadedBy.name}
        </p>
        {pod.verifiedAt && pod.verifiedByDgk && (
          <p className="text-xs text-emerald-700">
            Verified {formatWIBDateTime(pod.verifiedAt)} by {pod.verifiedByDgk.name}
          </p>
        )}
      </div>

      {pod.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {pod.photos.map((url, i) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-md border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`POD photo ${i + 1}`}
                className="aspect-square w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {pod.notes && (
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
          <p className="whitespace-pre-line">{pod.notes}</p>
        </div>
      )}

      {pod.receiverSignatureUrl && (
        <a
          href={pod.receiverSignatureUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm underline"
        >
          View receiver signature
        </a>
      )}
    </div>
  )
}
