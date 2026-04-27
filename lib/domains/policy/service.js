// lib/domains/policy/service.js
// Pure business logic — no DB access.

import { CANCELLED_STATUSES } from './types'

export function isPolicyActive(policy) {
  return !CANCELLED_STATUSES.includes((policy?.policy_status ?? '').toLowerCase())
}

// Encode auxiliary fields (real policy_no, doc path, extras) into the
// notes column. Single source of truth for the encoding/decoding.
export function encodePolicyNotes({ policyNumber, docPath, extras, freeText }) {
  return [
    policyNumber ? `[policy_no:${policyNumber}]` : '',
    (freeText ?? '').trim(),
    extras ? `[extra: ${extras}]` : '',
    docPath ? `[doc:${docPath}]` : '',
  ].filter(Boolean).join('\n').trim() || null
}

export function parsePolicyNotes(rawNotes) {
  if (!rawNotes) return { realPolicyNo: null, docPath: null, cleanNotes: '' }
  const policyNoMatch = rawNotes.match(/\[policy_no:(.*?)\]/)
  const docMatch      = rawNotes.match(/\[doc:(.*?)\]/)
  const cleanNotes    = rawNotes
    .replace(/\[policy_no:.*?\]/g, '')
    .replace(/\[doc:.*?\]/g, '')
    .replace(/\[extra:.*?\]/g, '')
    .trim()
  return {
    realPolicyNo: policyNoMatch ? policyNoMatch[1].trim() : null,
    docPath:      docMatch      ? docMatch[1].trim()      : null,
    cleanNotes,
  }
}

// Recompute policy_status based on its installments.
// - any unpaid installment past cancelDays  → 'overdue'
// - all paid                                → keep 'active' (book closed elsewhere)
// - else                                    → 'active'
export function derivePolicyStatus(currentStatus, installments, agentCode) {
  if (CANCELLED_STATUSES.includes(currentStatus)) return currentStatus
  const cancelDays = agentCode?.cancel_after_days ?? 30
  const today = new Date(); today.setHours(0,0,0,0)
  const hasOverdue = (installments ?? []).some(i => {
    if (i.paid_at) return false
    const due = new Date(i.due_date); due.setHours(0,0,0,0)
    const days = Math.floor((today - due) / 86400000)
    return days > cancelDays
  })
  return hasOverdue ? 'overdue' : 'active'
}
