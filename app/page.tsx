import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { UserRole } from "@/prisma/generated/enums"

export default async function RootPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === UserRole.CUSTOMER_USER) redirect("/portal")
  redirect("/dashboard")
}
