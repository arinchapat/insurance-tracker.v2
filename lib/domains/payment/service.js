// Single chokepoint for recording a payment against an installment.
//
// Replaces the two ad-hoc payment paths previously in
// app/(app)/collect/page.js and app/(app)/policies/[id]/page.js.
// Pages MUST call recordPayment instead of updating installments directly.

import * as paymentRepo from './repository'
import * as storage     from '@/lib/storage'

// Record one payment event.
// - Uploads the slip (if provided) to the canonical path derived from a
//   pre-generated payment id, so storage path == row id (no extra round-trip).
// - Inserts the payments row.
// - Updates the legacy installment summary fields (paid_at/paid_amount/slip_url)
//   so existing readers (dashboard, remit, collect list) keep working during
//   the migration period. Will be removed once those readers switch to
//   v_installment_status.
export async function recordPayment(supabase, {
  installmentId,
  userId,
  amount,
  channel = null,
  file    = null,
  notes   = null,
  paidAt  = null,
}) {
  if (!installmentId)        throw new Error('missing installmentId')
  if (!userId)               throw new Error('missing userId')
  if (!(Number(amount) > 0)) throw new Error('amount must be > 0')

  const id        = crypto.randomUUID()
  const paid_at   = paidAt ?? new Date().toISOString()
  const cleanNote = notes && notes.trim() ? notes.trim() : null

  let slip_path = null
  if (file) {
    slip_path = await storage.uploadSlip(supabase, { userId, paymentId: id, file })
  }

  const row = {
    id,
    installment_id: installmentId,
    user_id:        userId,
    amount:         Number(amount),
    channel,
    slip_path,
    paid_at,
    notes:          cleanNote,
  }

  try {
    await paymentRepo.insert(supabase, row)
  } catch (err) {
    if (slip_path) await storage.removeSlip(supabase, slip_path).catch(() => {})
    throw err
  }

  // Legacy summary fields — remove once readers migrate to v_installment_status.
  await supabase.from('installments').update({
    paid_at,
    paid_amount: row.amount,
    slip_url:    slip_path,
  }).eq('id', installmentId).eq('user_id', userId)

  return row
}

// Re-export for convenience.
export { paymentRepo }
