import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { OrderStatus, DeliveryOrderStatus } from "@/prisma/generated/enums"

type AnyStatus = OrderStatus | DeliveryOrderStatus

const labelByStatus: Record<AnyStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned",
  PENDING: "Pending",
  ACKNOWLEDGED: "Acknowledged",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  INVOICED: "Invoiced",
  PAID: "Paid",
  CANCELLED: "Cancelled",
}

// Minimal color language — default variant covers most states; CANCELLED
// reads as destructive, PAID/DELIVERED as success (emerald override),
// terminal-but-neutral like DRAFT as secondary.
const classByStatus: Record<AnyStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SUBMITTED: "",
  ASSIGNED: "",
  PENDING: "",
  ACKNOWLEDGED: "",
  DISPATCHED: "",
  IN_TRANSIT: "",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  INVOICED: "",
  PAID: "bg-emerald-600 text-white",
  CANCELLED: "",
}

const variantByStatus: Record<AnyStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  SUBMITTED: "default",
  ASSIGNED: "default",
  PENDING: "secondary",
  ACKNOWLEDGED: "default",
  DISPATCHED: "default",
  IN_TRANSIT: "default",
  DELIVERED: "default",
  INVOICED: "secondary",
  PAID: "default",
  CANCELLED: "destructive",
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  return (
    <Badge
      variant={variantByStatus[status]}
      className={cn(classByStatus[status])}
    >
      {labelByStatus[status]}
    </Badge>
  )
}
