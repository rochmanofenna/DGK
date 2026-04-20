/**
 * Live-tracking shared constants.
 *
 * `MAX_TRACKING_ACCURACY_METERS` — fixes reported less accurate than
 * this are filtered out at render time. Raw rows are kept in
 * `LocationUpdate` (the ingest endpoint doesn't drop them) so a noisy
 * window doesn't become a trail gap; only the renderer decides what's
 * trustworthy. 200m is "phone GPS dropped indoors / urban canyon"
 * territory; below that we trust the fix enough to pin on a map.
 *
 * `TRACKING_TRAIL_LIMIT` — how many points to plot as breadcrumbs.
 * Beyond this the map gets noisy and the payload bloats. Newest N wins.
 */
export const MAX_TRACKING_ACCURACY_METERS = 200
export const TRACKING_TRAIL_LIMIT = 50
