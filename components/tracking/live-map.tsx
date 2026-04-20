"use client"

import L from "leaflet"
import { useEffect, useMemo } from "react"
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet"

import "leaflet/dist/leaflet.css"

/**
 * Leaflet + OpenStreetMap renderer. Intentionally framework-agnostic
 * about *where* the data came from — the caller passes a current pin
 * and (optionally) a trail of earlier points. Server components do the
 * DB fetch; this component only paints.
 *
 * MUST be loaded with `dynamic(() => ..., { ssr: false })` — Leaflet
 * touches `window` at import time. Doing so inside this file would make
 * the import order unsafe on the server, so the caller owns the
 * dynamic boundary.
 */

export interface MapPoint {
  latitude: number
  longitude: number
}

export interface LiveMapProps {
  pin: MapPoint | null
  trail?: MapPoint[]
  /** Default zoom when a pin is present. 14 ≈ street-level. */
  zoom?: number
  /** Centre to fall back on when no pin yet — defaults to Jakarta. */
  fallbackCenter?: MapPoint
  className?: string
}

// Jakarta city centre — sensible default for a JABODETABEK logistics app.
const DEFAULT_FALLBACK: MapPoint = { latitude: -6.2, longitude: 106.816666 }

// Leaflet's built-in marker image URLs are broken under bundlers that
// don't rewrite CSS-relative asset paths, so we render a CSS-only pin
// via divIcon. Matches the "brand red" language used across the app.
const PIN_ICON = L.divIcon({
  className: "dgk-live-pin",
  html: '<span class="dgk-live-pin-dot" aria-hidden></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

/** Re-centre the map whenever the pin moves. */
function Recenter({ pin, zoom }: { pin: MapPoint; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([pin.latitude, pin.longitude], zoom, { animate: true })
  }, [map, pin.latitude, pin.longitude, zoom])
  return null
}

export default function LiveMap({
  pin,
  trail = [],
  zoom = 14,
  fallbackCenter = DEFAULT_FALLBACK,
  className,
}: LiveMapProps) {
  const center = pin ?? fallbackCenter
  const polyline = useMemo(
    () => trail.map((p) => [p.latitude, p.longitude] as [number, number]),
    [trail],
  )

  return (
    <div
      className={className}
      style={{ height: "320px", width: "100%", borderRadius: "0.5rem", overflow: "hidden" }}
    >
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={pin ? zoom : 11}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
        />
        {polyline.length > 1 && (
          <Polyline
            positions={polyline}
            pathOptions={{
              color: "var(--brand-red, #cc2229)",
              weight: 3,
              opacity: 0.85,
            }}
          />
        )}
        {pin && (
          <>
            <Marker position={[pin.latitude, pin.longitude]} icon={PIN_ICON} />
            <Recenter pin={pin} zoom={zoom} />
          </>
        )}
      </MapContainer>
      <style>{`
        .dgk-live-pin { display: block; }
        .dgk-live-pin-dot {
          display: block;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: var(--brand-red, #cc2229);
          box-shadow: 0 0 0 4px rgba(204, 34, 41, 0.25), 0 0 0 1px rgba(255,255,255,0.9) inset;
        }
      `}</style>
    </div>
  )
}
