import Image from "next/image"

import dgkLogo from "@/public/logo-dgk.jpeg"
import { cn } from "@/lib/utils"

/**
 * DGK brand mark — renders the real logo image file and nothing else.
 *
 * Do not reconstruct any part of this lockup in code (SVG, CSS, or canvas).
 * The file at `public/logo-dgk.jpeg` already contains the red icon square,
 * the "DINAMIKA GLOBAL KORPORA" wordmark, and the "HOLDINGS CORPORATION"
 * subtitle. Wrapping it with extra text or redrawing the arrow duplicates
 * or misrepresents the artwork (see 2026-04-19 correction from Tante Lulu).
 *
 * Native pixel dimensions: 1228 × 610. Aspect ~2.013:1.
 */

interface DGKLogoProps {
  /** Pixel width for the rendered logo. Height derives from aspect ratio. */
  width?: number
  className?: string
  /** Use `priority` above-the-fold (login hero, header) to avoid LCP hit. */
  priority?: boolean
}

const LOGO_ASPECT = 1228 / 610

export function DGKLogo({
  width = 160,
  className,
  priority = false,
}: DGKLogoProps) {
  const height = Math.round(width / LOGO_ASPECT)
  return (
    <Image
      src={dgkLogo}
      alt="DGK — Dinamika Global Korpora Holdings Corporation"
      width={width}
      height={height}
      className={cn("select-none", className)}
      priority={priority}
    />
  )
}
