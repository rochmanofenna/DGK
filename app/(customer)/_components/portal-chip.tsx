/**
 * Small "Client portal" pill shown beside the DGK logo in the customer
 * portal header. Purely an identification cue — lets someone glance at
 * the screen and know instantly whether they're looking at the staff
 * ERP or a customer-facing view.
 */
export function PortalChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-[color:var(--brand-blue)]/30 bg-[color:var(--brand-blue)]/8 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--brand-blue)]">
      Client portal
    </span>
  )
}
