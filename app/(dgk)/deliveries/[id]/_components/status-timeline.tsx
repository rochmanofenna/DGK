import { formatWIBDateTime } from "@/lib/time"
import type { DeliveryCheckpoint } from "@/prisma/generated/enums"

interface TimelineEvent {
  at: Date
  label: string
  meta?: string | null
  notes?: string | null
}

interface StatusTimelineProps {
  deliveryOrder: {
    createdAt: Date
    dispatchedAt: Date | null
    deliveredAt: Date | null
    assignedBy: { name: string }
  }
  checklist: Array<{
    id: string
    checkpoint: DeliveryCheckpoint
    timestamp: Date
    notes: string | null
    photoUrl: string | null
    verifiedBy: { name: string } | null
  }>
  pod: {
    createdAt: Date
    verifiedAt: Date | null
    receiverName: string
    uploadedBy: { name: string }
    verifiedByDgk: { name: string } | null
  } | null
}

const CHECKPOINT_LABEL: Record<DeliveryCheckpoint, string> = {
  PICKUP: "Pickup",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived",
  UNLOADING: "Unloading",
  COMPLETED: "Completed",
}

export function StatusTimeline({
  deliveryOrder,
  checklist,
  pod,
}: StatusTimelineProps) {
  const events: TimelineEvent[] = [
    {
      at: deliveryOrder.createdAt,
      label: "Delivery order created",
      meta: `Assigned by ${deliveryOrder.assignedBy.name}`,
    },
  ]

  if (deliveryOrder.dispatchedAt) {
    events.push({ at: deliveryOrder.dispatchedAt, label: "Dispatched" })
  }

  for (const c of checklist) {
    events.push({
      at: c.timestamp,
      label: CHECKPOINT_LABEL[c.checkpoint],
      meta: c.verifiedBy ? `by ${c.verifiedBy.name}` : null,
      notes: c.notes,
    })
  }

  if (pod) {
    events.push({
      at: pod.createdAt,
      label: "POD uploaded",
      meta: `by ${pod.uploadedBy.name} · received by ${pod.receiverName}`,
    })
    if (pod.verifiedAt && pod.verifiedByDgk) {
      events.push({
        at: pod.verifiedAt,
        label: "POD verified",
        meta: `by ${pod.verifiedByDgk.name}`,
      })
    }
  }

  if (deliveryOrder.deliveredAt) {
    events.push({ at: deliveryOrder.deliveredAt, label: "Delivered" })
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime())

  return (
    <ol className="relative space-y-5 border-l pl-6">
      {events.map((ev, i) => (
        <li key={`${ev.at.getTime()}-${i}`} className="relative">
          <span
            className="absolute -left-[7px] top-1.5 size-3 rounded-full bg-primary ring-4 ring-background"
            aria-hidden
          />
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium">{ev.label}</p>
            <p className="text-xs whitespace-nowrap text-muted-foreground">
              {formatWIBDateTime(ev.at)}
            </p>
          </div>
          {ev.meta && (
            <p className="mt-0.5 text-xs text-muted-foreground">{ev.meta}</p>
          )}
          {ev.notes && (
            <p className="mt-1 text-sm whitespace-pre-line">{ev.notes}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
