"use client"

import { useActionState, useId } from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import { signInAction, type LoginState } from "./actions"

export type LoginVariant = "employee" | "client"

interface LoginFormProps {
  callbackUrl: string
  initialError?: string
  variant?: LoginVariant
  /** Focus the email input on mount — exactly one form per page should set this. */
  autoFocus?: boolean
}

const initialState: LoginState = { error: null }

export function LoginForm({
  callbackUrl,
  initialError,
  variant = "employee",
  autoFocus = false,
}: LoginFormProps) {
  const [state, action] = useActionState(
    signInAction,
    initialError ? { error: initialError } : initialState,
  )

  // Unique field ids so two forms on the same page don't collide on
  // `for`/`id` pairing (breaks label-click behavior + accessibility tools).
  const id = useId()
  const emailId = `${id}-email`
  const passwordId = `${id}-password`

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="space-y-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus={autoFocus}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          id={passwordId}
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">
          Invalid email or password.
        </p>
      )}

      <SubmitButton variant={variant} />
    </form>
  )
}

function SubmitButton({ variant }: { variant: LoginVariant }) {
  const { pending } = useFormStatus()
  // Client variant swaps the default red primary for brand-blue so the
  // two cards read as "two doors" — same lobby, different entrance.
  const isClient = variant === "client"
  return (
    <Button
      type="submit"
      className={cn(
        "w-full",
        isClient &&
          "bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue)]/90",
      )}
      disabled={pending}
    >
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  )
}
