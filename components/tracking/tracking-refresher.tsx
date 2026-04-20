"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

interface TrackingRefresherProps {
  /** Polling interval in ms. Default 30s — a middle ground between
   * "stale pin on the map" and "extra server load for every viewer". */
  intervalMs?: number
  /** When false, the refresher no-ops. Lets callers disable polling
   * without unmounting the component (avoids re-render churn when a
   * tracking session ends). */
  enabled?: boolean
}

/**
 * Triggers `router.refresh()` on a fixed cadence so the map surface
 * re-fetches the latest `TrackingSnapshot` from the server. Keeping
 * the data fetch on the server is deliberate: the pin query is the
 * same one that runs on initial render, and the tenancy rules live
 * with the page, not the component.
 *
 * Pauses when the tab is hidden — a pinned background tab shouldn't
 * cost a request every 30 seconds.
 */
export function TrackingRefresher({
  intervalMs = 30_000,
  enabled = true,
}: TrackingRefresherProps) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | null = null

    function start() {
      if (timer) return
      timer = setInterval(() => router.refresh(), intervalMs)
    }
    function stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start()
      else stop()
    }

    if (document.visibilityState === "visible") start()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, intervalMs, router])

  return null
}
