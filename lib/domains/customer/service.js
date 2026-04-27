// lib/domains/customer/service.js
// Pure helpers — no DB.

export function displayName(customer) {
  if (!customer) return ''
  const prefix = customer.prefix ? `${customer.prefix} ` : ''
  const name   = customer.name ?? ''
  return name.startsWith(prefix.trim()) ? name : `${prefix}${name}`
}

// Convert "DD/MM/YYYY" → "YYYY-MM-DD" (or null).
export function thaiDateToISO(s) {
  if (!s) return null
  const [dd, mm, yyyy] = s.split('/')
  if (!dd || !mm || !yyyy) return null
  return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
}
