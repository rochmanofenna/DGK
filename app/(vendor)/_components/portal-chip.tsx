/**
 * "Carrier portal" pill shown beside the DGK logo in the vendor portal
 * header. Identification cue — one glance tells a DGK employee testing
 * with a vendor account that they're in the carrier-facing view, not
 * the staff ERP.
 */
export function PortalChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--brand-green)]/30 bg-[color:var(--brand-green)]/8 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--brand-green)]">
      Carrier portal
    </span>
  )
}
