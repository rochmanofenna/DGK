import { db } from "@/lib/db"

import { OrderForm } from "../_components/order-form"

export default async function NewOrderPage() {
  const customers = await db.customer.findMany({
    where: { organization: { type: "CUSTOMER" } },
    select: {
      id: true,
      organization: { select: { name: true } },
    },
    orderBy: { organization: { name: "asc" } },
  })

  const customerOptions = customers.map((c) => ({
    id: c.id,
    name: c.organization.name,
  }))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New order</h1>
        <p className="text-sm text-muted-foreground">
          Create an order on behalf of a customer. Vendor assignment happens
          next, after Ops reviews.
        </p>
      </div>
      <OrderForm customers={customerOptions} />
    </div>
  )
}
