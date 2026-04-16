import { auth } from "@/auth"

export default async function DashboardPage() {
  const session = await auth()
  const roleLabel = session?.user.role.replace(/_/g, " ").toLowerCase()

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome, {session?.user.name}. Your role is{" "}
        <span className="capitalize">{roleLabel}</span>.
      </p>
      <p className="text-sm text-muted-foreground">
        Placeholder. Module 5 (Orders) lands here next.
      </p>
    </div>
  )
}
