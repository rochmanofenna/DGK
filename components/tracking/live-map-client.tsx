"use client"

import dynamic from "next/dynamic"

/**
 * Server-component-safe wrapper. `LiveMap` pulls in Leaflet which
 * touches `window` at import time, so SSR is disabled. Server
 * components can import this file directly and render `<LiveMapClient>`
 * without worrying about the dynamic boundary.
 *
 * `loading` returns a soft skeleton so the card keeps its vertical
 * rhythm while the bundle streams in.
 */
const LiveMapClient = dynamic(() => import("./live-map"), {
  ssr: false,
  loading: () => (
    <div
      aria-label="Loading map"
      style={{
        height: "320px",
        width: "100%",
        borderRadius: "0.5rem",
        background:
          "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.08))",
      }}
    />
  ),
})

export default LiveMapClient
