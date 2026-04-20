"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

interface TrackingControlsProps {
  deliveryOrderId: string
}

type Status =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "active"; lastSentAt: number | null }
  | { kind: "error"; message: string }

/**
 * Courier-facing start/stop control. Lives on the carrier DO detail
 * page and only renders when the DO is DISPATCHED (parent enforces).
 *
 * Browser APIs used:
 *   - `navigator.geolocation.watchPosition` — fires whenever the OS
 *     serves a new fix. Rate is phone-dependent (every few seconds on
 *     modern Android; slower in power-save). The ingest endpoint
 *     enforces its own 10-second floor, so we don't throttle here.
 *   - `navigator.wakeLock.request('screen')` — stops the screen from
 *     sleeping while tracking is on. Released on stop / unmount. Not
 *     supported on iOS Safari < 16.4 or Firefox Android; we degrade
 *     silently if unavailable.
 *   - `visibilitychange` — when the page is hidden (tab backgrounded,
 *     phone locks) the watch can pause. On return we simply re-arm by
 *     taking the next fix from the existing watch; no reset is needed.
 *
 * POST failures (offline, rate-limited) are *not* surfaced aggressively
 * — a courier driving doesn't want a toast every 10 seconds. The UI
 * shows the time of the last successful post; silence means something's
 * wrong. 429s are normal and get absorbed.
 */
export function TrackingControls({ deliveryOrderId }: TrackingControlsProps) {
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const watchIdRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const postLocation = useCallback(
    async (position: GeolocationPosition) => {
      try {
        const res = await fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryOrderId,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            headingDegrees:
              position.coords.heading != null && !Number.isNaN(position.coords.heading)
                ? position.coords.heading
                : undefined,
            speedMps:
              position.coords.speed != null && !Number.isNaN(position.coords.speed)
                ? position.coords.speed
                : undefined,
            recordedAt: new Date(position.timestamp).toISOString(),
          }),
        })
        // 429 (rate-limited) is expected whenever the OS emits fast fixes.
        // Treat it as "soft skip" — the last successful write is still fresh.
        if (res.ok) {
          setStatus({ kind: "active", lastSentAt: Date.now() })
        }
      } catch {
        // Network hiccups in the field are normal; the next fix retries.
      }
    },
    [deliveryOrderId],
  )

  const acquireWakeLock = useCallback(async () => {
    // Wake Lock API is gated behind a user gesture + secure context.
    // Silently no-op if unsupported; tracking still works, the screen
    // just sleeps on its normal timer.
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen")
    } catch {
      wakeLockRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
      } catch {
        // already released
      }
      wakeLockRef.current = null
    }
  }, [])

  const stop = useCallback(async () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    await releaseWakeLock()
    setStatus({ kind: "idle" })
  }, [releaseWakeLock])

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus({
        kind: "error",
        message: "This device doesn't support geolocation.",
      })
      return
    }
    setStatus({ kind: "starting" })
    await acquireWakeLock()
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void postLocation(position)
      },
      (err) => {
        setStatus({
          kind: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission blocked — allow it in your browser, then try again."
              : "Couldn't read location from the device.",
        })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    )
  }, [acquireWakeLock, postLocation])

  // Re-acquire the wake lock when the page becomes visible again. Chrome
  // auto-releases it on tab hide; the courier usually re-opens the app
  // when the phone screen turns back on.
  useEffect(() => {
    function onVisibility() {
      if (
        document.visibilityState === "visible" &&
        status.kind === "active" &&
        wakeLockRef.current === null
      ) {
        void acquireWakeLock()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [status.kind, acquireWakeLock])

  // Clean up on unmount — clearWatch prevents stale callbacks, wake lock
  // must be released explicitly or the screen stays on indefinitely.
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release()
        wakeLockRef.current = null
      }
    }
  }, [])

  const isActive = status.kind === "active" || status.kind === "starting"
  const isStarting = status.kind === "starting"

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Live tracking</p>
          <p className="text-xs text-muted-foreground">
            {status.kind === "active" && status.lastSentAt
              ? `Last ping ${formatAgo(status.lastSentAt)}`
              : status.kind === "active"
                ? "Waiting for first fix…"
                : status.kind === "starting"
                  ? "Requesting location…"
                  : status.kind === "error"
                    ? status.message
                    : "Tracking is off. Customers and DGK only see your position while this is on."}
          </p>
        </div>
        {isActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void stop()}
            disabled={isStarting}
          >
            Stop tracking
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={() => void start()}>
            Start tracking
          </Button>
        )}
      </div>
      {status.kind === "error" && (
        <p className="text-xs text-destructive">{status.message}</p>
      )}
    </div>
  )
}

function formatAgo(timestamp: number): string {
  const secs = Math.max(0, Math.round((Date.now() - timestamp) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  return `${hours}h ago`
}
