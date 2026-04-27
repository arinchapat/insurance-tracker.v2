// lib/domains/installment/repository.js
// DB access only — no business logic. RLS handles user_id filtering.

const SELECT_BASE = `
  id, policy_id, installment_no, total_inst,
  amount_due, due_date, paid_at, paid_amount,
  slip_url, notes, created_at, user_id
`

export async function listForPolicy(supabase, policyId) {
  const { data, error } = await supabase
    .from('installments')
    .select(SELECT_BASE)
    .eq('policy_id', policyId)
    .order('installment_no')
  if (error) throw error
  return data ?? []
}

export async function listAllWithPolicy(supabase, userId) {
  const { data, error } = await supabase
    .from('installments')
    .select(`
      *,
      policies(
        id, policy_status, company_id, agent_code, coverage_type, plate, model,
        customers(id, name, phone),
        agent_codes(cancel_after_days, warn_day, critical_day, notify_before_due, bill_cycle_day)
      )
    `)
    .eq('user_id', userId)
    .order('due_date')
  if (error) throw error
  return data ?? []
}

export async function listUnpaid(supabase, userId) {
  const { data, error } = await supabase
    .from('installments')
    .select(SELECT_BASE)
    .eq('user_id', userId)
    .is('paid_at', null)
    .order('due_date')
  if (error) throw error
  return data ?? []
}

export async function insertMany(supabase, rows) {
  const { error } = await supabase.from('installments').insert(rows)
  if (error) throw error
}

export async function recordPayment(supabase, id, { paidAt, paidAmount, slipUrl }) {
  const patch = { paid_at: paidAt, paid_amount: paidAmount }
  if (slipUrl) patch.slip_url = slipUrl
  const { error } = await supabase.from('installments').update(patch).eq('id', id)
  if (error) throw error
}

export async function applyFifoUpdates(supabase, updates) {
  for (const u of updates) {
    const { error } = await supabase
      .from('installments')
      .update({ paid_amount: u.paid_amount, paid_at: u.paid_at })
      .eq('id', u.id)
    if (error) throw error
  }
}
