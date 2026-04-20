import Link from "next/link"

import { Button } from "@/components/ui/button"

import { CustomerOrderForm } from "./_components/customer-order-form"

export default function NewCustomerOrderPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Shipping request
          </p>
          <h1 className="text-2xl font-semibold">New order</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us what&apos;s moving and where. DGK confirms pricing and
            schedules a truck.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/portal/orders">Back</Link>
        </Button>
      </div>

      <CustomerOrderForm />
    </div>
  )
}
