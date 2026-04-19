import { cn } from "@/lib/utils"

/**
 * DGK brand mark — hand-built SVG so it stays crisp at every size, can be
 * recolored for monochrome letterhead, and ships without extra network
 * weight. The geometry is reconstructed from the spec sheet Dylan sent
 * (40x15 cm lockup): red rounded square with a white upward-right block
 * arrow, bold condensed wordmark, and a smaller blue subtitle.
 *
 * Color tokens live in globals.css as --brand-red and --brand-blue so a
 * single palette shift (e.g. if Dylan supplies exact Pantones) flows
 * everywhere the logo appears.
 */

type Variant = "icon" | "horizontal" | "stacked"

interface DGKLogoProps {
  variant?: Variant
  /** Pixel height of the icon square. Wordmark scales off this. */
  size?: number
  className?: string
  /** Render in a single foreground color (for dark backgrounds / print). */
  monochrome?: boolean
  /** Hide the "HOLDINGS CORPORATION" subline — useful in tight headers. */
  showSubline?: boolean
  /** Optional accessible name. Icon-only uses this as aria-label. */
  title?: string
}

function IconMark({
  size,
  monochrome,
  className,
  title,
}: {
  size: number
  monochrome: boolean
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
      shapeRendering="geometricPrecision"
    >
      <rect
        width="100"
        height="100"
        rx="14"
        fill={monochrome ? "currentColor" : "var(--brand-red)"}
      />
      <path
        d="M20 60 H60 V70 L80 50 L60 30 V40 H20 Z"
        fill={monochrome ? "var(--background)" : "#ffffff"}
        transform="rotate(-45 50 50)"
      />
    </svg>
  )
}

export function DGKLogo({
  variant = "horizontal",
  size = 40,
  className,
  monochrome = false,
  showSubline = true,
  title = "DGK — Dinamika Global Korpora",
}: DGKLogoProps) {
  if (variant === "icon") {
    return (
      <IconMark
        size={size}
        monochrome={monochrome}
        className={className}
        title={title}
      />
    )
  }

  // Horizontal lockup — icon + wordmark side-by-side.
  if (variant === "horizontal") {
    const wordmarkSize = Math.round(size * 0.48)
    const sublineSize = Math.round(size * 0.2)
    const gap = Math.round(size * 0.28)
    return (
      <div
        className={cn("flex items-center", className)}
        style={{ gap: `${gap}px` }}
        role="img"
        aria-label={title}
      >
        <IconMark size={size} monochrome={monochrome} />
        <div className="flex flex-col leading-[0.95]">
          <span
            className="font-wordmark font-extrabold uppercase tracking-[-0.005em]"
            style={{
              fontSize: `${wordmarkSize}px`,
              color: monochrome ? "currentColor" : "var(--foreground)",
            }}
          >
            Dinamika Global Korpora
          </span>
          {showSubline && (
            <span
              className="mt-[0.35em] font-wordmark font-semibold uppercase"
              style={{
                fontSize: `${sublineSize}px`,
                letterSpacing: "0.22em",
                color: monochrome
                  ? "currentColor"
                  : "var(--brand-blue)",
              }}
            >
              Holdings Corporation
            </span>
          )}
        </div>
      </div>
    )
  }

  // Stacked — icon on top, wordmark centered below (login hero usage).
  const wordmarkSize = Math.round(size * 0.34)
  const sublineSize = Math.round(size * 0.15)
  return (
    <div
      className={cn("flex flex-col items-center text-center", className)}
      role="img"
      aria-label={title}
    >
      <IconMark size={size} monochrome={monochrome} />
      <span
        className="mt-5 font-wordmark font-extrabold uppercase tracking-[-0.005em]"
        style={{
          fontSize: `${wordmarkSize}px`,
          color: monochrome ? "currentColor" : "var(--foreground)",
        }}
      >
        Dinamika Global Korpora
      </span>
      {showSubline && (
        <span
          className="mt-1.5 font-wordmark font-semibold uppercase"
          style={{
            fontSize: `${sublineSize}px`,
            letterSpacing: "0.3em",
            color: monochrome ? "currentColor" : "var(--brand-blue)",
          }}
        >
          Holdings Corporation
        </span>
      )}
    </div>
  )
}
