// Timezone-safe date helpers. App runs in Asia/Bangkok (UTC+7).
// Replaces the unsafe `.toISOString().split('T')[0]` pattern that drifts
// one day backward near midnight for users in UTC+7.

const TZ = 'Asia/Bangkok'

const ISO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year:  'numeric',
  month: '2-digit',
  day:   '2-digit',
})

// Format a Date (or ISO string) as "YYYY-MM-DD" in Bangkok local time.
export function toISODate(date) {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return ISO_FORMATTER.format(d)
}

// Add `n` calendar months, preserving day-of-month where possible.
export function addMonths(date, n) {
  const d = date instanceof Date ? new Date(date) : new Date(date)
  d.setMonth(d.getMonth() + n)
  return d
}

// Parse "DD/MM/YYYY" → "YYYY-MM-DD" (or null).
export function parseDDMMYYYY(s) {
  if (!s) return null
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}
