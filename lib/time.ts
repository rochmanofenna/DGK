/**
 * Indonesian time utilities.
 *
 * DGK operates on WIB (Waktu Indonesia Barat / Western Indonesia Time,
 * UTC+7) — the timezone for Jakarta, Bandung, and the other
 * western-Indonesia cities Transcoll ships to. Indonesia does not
 * observe DST, so WIB is UTC+7 year-round.
 *
 * Store UTC in the database; format to WIB for display.
 * "H-1 16:00 WIB" in the Transcoll contract = 16:00 WIB on the day
 * before the pickup date.
 */

export const WIB_TIMEZONE = "Asia/Jakarta"

const WIB_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
})

const WIB_DATETIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: WIB_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatWIBDate(date: Date): string {
  return WIB_DATE_FORMATTER.format(date)
}

export function formatWIBDateTime(date: Date): string {
  return `${WIB_DATETIME_FORMATTER.format(date)} WIB`
}

/**
 * Returns 16:00 WIB on the day before the pickup date — the Transcoll
 * on-call cutoff ("min H-1 by 16:00 WIB"). 16:00 WIB == 09:00 UTC.
 *
 * TODO(phase-2): this assumes pickupDate is normalized to midnight UTC
 * of the pickup day. For MVP, Order.pickup_date is a date-only field,
 * so that holds.
 */
export function onCallCutoff(pickupDate: Date): Date {
  const cutoff = new Date(pickupDate)
  cutoff.setUTCDate(cutoff.getUTCDate() - 1)
  cutoff.setUTCHours(9, 0, 0, 0) // 09:00 UTC = 16:00 WIB (UTC+7, no DST)
  return cutoff
}
